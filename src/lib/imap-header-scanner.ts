import { ImapFlow } from "imapflow";
import { getGmailClient } from "./google";
import { loadIMAPSettings, loadIMAPProgress } from "./firestore";
import { PasswordEncryption } from "./crypto";

// In-memory storage for IMAP job progress (in production, use Redis or database)
const imapJobs = new Map<string, any>();

export interface ContactScanResult {
  senders: string[];
  recipients: string[];
  messageCount: number;
}

export class IMAPHeaderScanner {
  /**
   * Authenticate with IMAP using Gmail OAuth
   */
  private static async getIMAPAccessToken(refreshToken: string): Promise<string> {
    try {
      // Get fresh access token using existing Gmail auth
      const { auth: oauth2Client } = await getGmailClient(refreshToken);
      const { token } = await oauth2Client.getAccessToken();
      return token!;
    } catch (error) {
      throw new Error(`Failed to get IMAP access token: ${error}`);
    }
  }

  /**
   * Scan Gmail mailbox headers using IMAP (fast method with app password or OAuth)
   */
  static async scanHeaders(refreshToken: string): Promise<ContactScanResult> {
    // Get user email first to check for IMAP settings
    const { email } = await getGmailClient(refreshToken);

    // Load user preferences for scanning
    const imapSettings = await loadIMAPSettings(email);

    // Use configurable options with smart defaults
    const maxMessages = imapSettings?.maxMessages || 10000; // Default: 10K chunked scanning
    const mailbox = imapSettings?.mailbox || "[Gmail]/All Mail"; // Default: All Mail

    let imapConfig: any;

    if (imapSettings?.enabled && imapSettings?.setupCompleted && imapSettings?.appPassword) {
      // Use app password authentication
      const appPassword = PasswordEncryption.decrypt(imapSettings.appPassword, email);
      imapConfig = {
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: {
          user: email, // Use actual email for app password auth
          pass: appPassword,
        },
        logger: false,
      };
      console.log("[IMAP] Using app password authentication");
    } else {
      // Fall back to OAuth token authentication
      const accessToken = await this.getIMAPAccessToken(refreshToken);
      imapConfig = {
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: {
          user: "me", // Special Gmail IMAP OAuth user identifier
          accessToken: accessToken,
        },
        logger: false,
      };
      console.log("[IMAP] Using OAuth token authentication (consider configuring app password for better reliability)");
    }

    const imap = new ImapFlow(imapConfig);

    try {
      await imap.connect();
      await imap.mailboxOpen(mailbox);

      // Get status to know how many messages there are
      const status = await imap.status(mailbox, { messages: true });
      const totalMessages = Math.min(status.messages || 0, maxMessages);

      console.log(
        `[IMAP] Opened mailbox "${mailbox}" with ${status.messages} messages (${totalMessages} will be processed)`
      );

      const sendersSet = new Set<string>();
      const recipientsSet = new Set<string>();

      // Process in batches to avoid memory issues
      const batchSize = 100;
      let processed = 0;

      console.log(`[IMAP] Scanning ${totalMessages} messages for contacts...`);

      while (processed < totalMessages) {
        const remaining = totalMessages - processed;
        const currentBatchSize = Math.min(batchSize, remaining);

        // Calculate message range (latest first)
        const startSeq = Math.max(1, totalMessages - processed - currentBatchSize + 1);
        const endSeq = totalMessages - processed;

        try {
          const messages = imap.fetch(`${startSeq}:${endSeq}`, {
            envelope: true,
            uid: false,
            flags: false,
            bodyStructure: false,
          });

          for await (const message of messages) {
            const envelope = message.envelope;

            if (!envelope) continue;

            // Extract FROM addresses
            if (envelope.from && envelope.from.length > 0) {
              envelope.from.forEach((addr: any) => {
                if (addr?.address) {
                  sendersSet.add(addr.address.toLowerCase());
                }
              });
            }

            // Extract TO addresses
            if (envelope.to && envelope.to.length > 0) {
              envelope.to.forEach((addr: any) => {
                if (addr?.address) {
                  recipientsSet.add(addr.address.toLowerCase());
                }
              });
            }

            // Extract CC addresses
            if (envelope.cc && envelope.cc.length > 0) {
              envelope.cc.forEach((addr: any) => {
                if (addr?.address) {
                  recipientsSet.add(addr.address.toLowerCase());
                }
              });
            }

            // Extract BCC addresses (when present in envelope)
            if (envelope.bcc && envelope.bcc.length > 0) {
              envelope.bcc.forEach((addr: any) => {
                if (addr?.address) {
                  recipientsSet.add(addr.address.toLowerCase());
                }
              });
            }
          }
        } catch (fetchError) {
          console.warn(`[IMAP] Batch fetch error: ${fetchError}`);
          // Continue with next batch rather than fail entirely
        }

        processed += currentBatchSize;
        console.log(
          `[IMAP] Processed ${processed}/${totalMessages} messages (${Math.round((processed / totalMessages) * 100)}%)`
        );
      }

      await imap.logout();

      const senders = Array.from(sendersSet);
      const recipients = Array.from(recipientsSet);

      console.log(
        `[IMAP] Scan complete: ${senders.length} senders, ${recipients.length} recipients from ${totalMessages} messages`
      );

      return {
        senders,
        recipients,
        messageCount: totalMessages,
      };
    } catch (error) {
      await imap.logout().catch(() => {}); // Ignore logout errors
      throw new Error(`IMAP scanning failed: ${error}`);
    }
  }

  /**
   * Async version of scanHeaders with progress tracking for UI (supports resume from offset)
   */
  static async scanHeadersAsync(
    refreshToken: string,
    email: string,
    jobId: string
  ): Promise<{
    senders: string[];
    recipients: string[];
    merged: string[];
    scanned: number;
    contacts: number;
    message: string;
    lastMessageScanned: number;
  }> {
    // Initialize job
    IMAPHeaderScanner.updateIMAPJob(jobId, {
      status: "running",
      startedAt: new Date().toISOString(),
      userEmail: email,
    });

    try {
      // Get IMAP settings and progress
      const imapSettings = await loadIMAPSettings(email);
      const imapProgress = await loadIMAPProgress(email);
      const maxMessages = imapSettings?.maxMessages || 10000; // 10K per scan for chunking
      const mailbox = imapSettings?.mailbox || "[Gmail]/All Mail";

      // Calculate scan range (resume from last position or start from 1)
      // If scan is complete, reset to start fresh rescan
      const lastScanned = imapProgress?.isComplete ? 0 : imapProgress?.lastMessageScanned || 0;
      const maxToScan = lastScanned + maxMessages; // Start from last + add chunk size

      // Setup IMAP connection
      let imapConfig: any;

      if (imapSettings?.enabled && imapSettings?.setupCompleted && imapSettings?.appPassword) {
        const appPassword = PasswordEncryption.decrypt(imapSettings.appPassword, email);
        imapConfig = {
          host: "imap.gmail.com",
          port: 993,
          secure: true,
          auth: { user: email, pass: appPassword },
          logger: false,
        };
      } else {
        const accessToken = await this.getIMAPAccessToken(refreshToken);
        imapConfig = {
          host: "imap.gmail.com",
          port: 993,
          secure: true,
          auth: { user: "me", accessToken: accessToken },
          logger: false,
        };
      }

      const imap = new ImapFlow(imapConfig);
      await imap.connect();
      await imap.mailboxOpen(mailbox);

      const status = await imap.status(mailbox, { messages: true });
      const totalMailboxMessages = status.messages || 0;

      // Determine actual scan range
      const startFrom = lastScanned + 1; // Start from next message
      const endAt = Math.min(totalMailboxMessages, maxToScan); // Don't scan past mailbox size
      const messagesInThisScan = Math.max(0, endAt - startFrom + 1);

      IMAPHeaderScanner.updateIMAPJob(jobId, {
        totalMessages: messagesInThisScan,
        mailbox: mailbox,
        message:
          lastScanned > 0
            ? `Continuing scan from message ${startFrom}...`
            : `Scanning messages 1-${messagesInThisScan} in ${mailbox}...`,
      });

      // Check if we've already scanned everything
      if (messagesInThisScan <= 0) {
        await imap.logout();
        const senders: string[] = [];
        const recipients: string[] = [];
        const merged: string[] = [];
        return {
          senders,
          recipients,
          merged,
          scanned: 0,
          contacts: 0,
          message: "All messages already scanned!",
          lastMessageScanned: lastScanned,
        };
      }

      const sendersSet = new Set<string>();
      const recipientsSet = new Set<string>();
      const batchSize = 100;
      let processed = 0;

      while (processed < messagesInThisScan) {
        // Check if job was cancelled
        const currentJobStatus = IMAPHeaderScanner.getIMAPJob(jobId)?.status;
        if (currentJobStatus === "cancelled") {
          console.log(`[IMAP] Job ${jobId} cancelled, stopping scan`);
          await imap.logout();
          const senders = Array.from(sendersSet);
          const recipients = Array.from(recipientsSet);
          const merged = Array.from(new Set([...senders, ...recipients]));
          return {
            senders,
            recipients,
            merged,
            scanned: processed,
            contacts: merged.length,
            message: "Scan was cancelled by user",
            lastMessageScanned: startFrom + processed - 1,
          };
        }

        const remaining = messagesInThisScan - processed;
        const currentBatchSize = Math.min(batchSize, remaining);

        // Calculate absolute sequence numbers for this chunk
        const startSeq = startFrom + processed;
        const endSeq = Math.min(startFrom + processed + currentBatchSize - 1, endAt);

        try {
          const messages = imap.fetch(`${startSeq}:${endSeq}`, {
            envelope: true,
            uid: false,
            flags: false,
            bodyStructure: false,
          });

          for await (const message of messages) {
            // Check if job was cancelled mid-batch
            if (IMAPHeaderScanner.getIMAPJob(jobId)?.status === "cancelled") {
              console.log(`[IMAP] Job ${jobId} cancelled during batch processing, stopping scan`);
              await imap.logout();
              const senders = Array.from(sendersSet);
              const recipients = Array.from(recipientsSet);
              const merged = Array.from(new Set([...senders, ...recipients]));
              return {
                senders,
                recipients,
                merged,
                scanned: processed + currentBatchSize, // Include current batch
                contacts: merged.length,
                message: "Scan was cancelled by user",
                lastMessageScanned: startFrom + processed + currentBatchSize - 1,
              };
            }

            const envelope = message.envelope;
            if (!envelope) continue;

            // Process addresses
            if (envelope.from && envelope.from.length > 0) {
              envelope.from.forEach((addr: any) => {
                if (addr?.address) {
                  sendersSet.add(addr.address.toLowerCase());
                }
              });
            }

            const recipientArrays = [envelope.to, envelope.cc, envelope.bcc].filter(Boolean);
            recipientArrays.forEach((recipients: any) => {
              if (recipients && recipients.length > 0) {
                recipients.forEach((addr: any) => {
                  if (addr?.address) {
                    recipientsSet.add(addr.address.toLowerCase());
                  }
                });
              }
            });
          }
        } catch (fetchError) {
          console.warn(`[IMAP] Batch fetch error: ${fetchError}`);
          // After error, check if cancelled to break the loop
          if (IMAPHeaderScanner.getIMAPJob(jobId)?.status === "cancelled") {
            console.log(`[IMAP] Job ${jobId} cancelled after batch error, stopping scan`);
            await imap.logout();
            const senders = Array.from(sendersSet);
            const recipients = Array.from(recipientsSet);
            const merged = Array.from(new Set([...senders, ...recipients]));
            return {
              senders,
              recipients,
              merged,
              scanned: processed,
              contacts: merged.length,
              message: "Scan was cancelled by user",
              lastMessageScanned: startFrom + processed - 1,
            };
          }
        }

        processed += currentBatchSize;
        const percentComplete = Math.round((processed / messagesInThisScan) * 100);

        // Check again after batch to be safe
        if (IMAPHeaderScanner.getIMAPJob(jobId)?.status === "cancelled") {
          console.log(`[IMAP] Job ${jobId} cancelled after batch, stopping scan`);
          await imap.logout();
          const senders = Array.from(sendersSet);
          const recipients = Array.from(recipientsSet);
          const merged = Array.from(new Set([...senders, ...recipients]));
          return {
            senders,
            recipients,
            merged,
            scanned: processed,
            contacts: merged.length,
            message: "Scan was cancelled by user",
            lastMessageScanned: startFrom + processed - 1,
          };
        }

        IMAPHeaderScanner.updateIMAPJob(jobId, {
          processedMessages: processed,
          percentComplete: percentComplete,
          contactsFound: sendersSet.size + recipientsSet.size,
          message: `Processed ${processed}/${messagesInThisScan} messages (${percentComplete}%)`,
        });
      }

      await imap.logout();

      const senders = Array.from(sendersSet);
      const recipients = Array.from(recipientsSet);
      const merged = Array.from(new Set([...senders, ...recipients]));

      return {
        senders,
        recipients,
        merged,
        scanned: messagesInThisScan,
        contacts: merged.length,
        message: `IMAP scan complete: Found ${merged.length} unique contacts from ${messagesInThisScan} messages`,
        lastMessageScanned: endAt,
      };
    } catch (error: any) {
      IMAPHeaderScanner.updateIMAPJob(jobId, {
        status: "failed",
        error: error.message,
        completedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Update IMAP job status (for progress tracking)
   */
  static updateIMAPJob(jobId: string, updates: any): void {
    const existing = imapJobs.get(jobId) || {
      jobId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    imapJobs.set(jobId, { ...existing, ...updates });
  }

  /**
   * Get IMAP job status (for UI polling)
   */
  static getIMAPJob(jobId: string): any {
    return imapJobs.get(jobId) || null;
  }
}
