import { ImapFlow } from "imapflow";
import { getGmailClient } from "./google";
import { loadIMAPSettings } from "./firestore";
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
    const maxMessages = imapSettings?.maxMessages || 50000; // Default: 50K messages for comprehensive scanning
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
   * Async version of scanHeaders with progress tracking for UI
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
  }> {
    // Initialize job
    IMAPHeaderScanner.updateIMAPJob(jobId, {
      status: "running",
      startedAt: new Date().toISOString(),
      userEmail: email,
    });

    try {
      // Get IMAP settings
      const imapSettings = await loadIMAPSettings(email);
      const maxMessages = imapSettings?.maxMessages || 50000;
      const mailbox = imapSettings?.mailbox || "[Gmail]/All Mail";

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
      const totalMessages = Math.min(status.messages || 0, maxMessages);

      IMAPHeaderScanner.updateIMAPJob(jobId, {
        totalMessages: totalMessages,
        mailbox: mailbox,
        message: `Scanning ${totalMessages} messages in ${mailbox}...`,
      });

      const sendersSet = new Set<string>();
      const recipientsSet = new Set<string>();
      const batchSize = 100;
      let processed = 0;

      while (processed < totalMessages) {
        const remaining = totalMessages - processed;
        const currentBatchSize = Math.min(batchSize, remaining);
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
        }

        processed += currentBatchSize;
        const percentComplete = Math.round((processed / totalMessages) * 100);

        IMAPHeaderScanner.updateIMAPJob(jobId, {
          processedMessages: processed,
          percentComplete: percentComplete,
          contactsFound: sendersSet.size + recipientsSet.size,
          message: `Processed ${processed}/${totalMessages} messages (${percentComplete}%)`,
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
        scanned: totalMessages,
        contacts: merged.length,
        message: `IMAP scan complete: Found ${merged.length} unique contacts from ${totalMessages} messages`,
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
