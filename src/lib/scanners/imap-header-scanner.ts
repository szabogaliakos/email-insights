import { ImapFlow } from "imapflow";
import { getGmailClient } from "../google";
import { loadIMAPSettings } from "../firestore";
import { PasswordEncryption } from "../crypto";
import { BaseScanner, ContactScanResult, ScanResult, ScanOptions, BatchResult } from "./base-scanner";
import { getIMAPConfig } from "./scanner-config";

export class IMAPHeaderScanner extends BaseScanner {
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
    const maxMessages = imapSettings?.maxMessages || 10000; // Increased default for IMAP performance (50K messages)
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

      // Process in batches for optimal IMAP performance
      const batchSize = 1000; // Increased from 100 for much faster IMAP scanning
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
   * Legacy method for backward compatibility - now delegates to BaseScanner
   */
  static async scanHeadersAsync(refreshToken: string, email: string, jobId: string): Promise<ScanResult> {
    const scanner = new IMAPHeaderScanner();
    const config = getIMAPConfig(); // Use centralized configuration
    return BaseScanner.scanAsync(refreshToken, email, jobId, scanner, config);
  }

  /**
   * Implement the abstract scanBatch method for IMAP
   */
  protected async scanBatch(
    refreshToken: string,
    email: string,
    options: ScanOptions & { offset?: number | string }
  ): Promise<BatchResult> {
    // Get IMAP settings
    const imapSettings = await loadIMAPSettings(email);
    const mailbox = options.mailbox || imapSettings?.mailbox || "[Gmail]/All Mail";
    const batchSize = options.batchSize || 1000;

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
      const accessToken = await IMAPHeaderScanner.getIMAPAccessToken(refreshToken);
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

    // Calculate scan range (BaseScanner handles resumption)
    const startFrom = (options.offset as number) || 1;
    const endAt = Math.min(totalMailboxMessages, startFrom + batchSize - 1);
    const messagesInThisBatch = Math.max(0, endAt - startFrom + 1);

    // Check if we've reached the end
    if (messagesInThisBatch <= 0) {
      await imap.logout();
      return {
        senders: new Set(),
        recipients: new Set(),
        processed: 0,
        hasMore: false,
      };
    }

    const sendersSet = new Set<string>();
    const recipientsSet = new Set<string>();

    try {
      const messages = imap.fetch(`${startFrom}:${endAt}`, {
        envelope: true,
        uid: false,
        flags: false,
        bodyStructure: false,
      });

      for await (const message of messages) {
        const envelope = message.envelope;
        if (!envelope) continue;

        // Process addresses using shared utility
        if (envelope.from && envelope.from.length > 0) {
          this.extractEmailsFromAddresses(envelope.from).forEach((addr) => sendersSet.add(addr));
        }

        [envelope.to, envelope.cc, envelope.bcc].filter(Boolean).forEach((recipients: any) => {
          if (recipients && recipients.length > 0) {
            this.extractEmailsFromAddresses(recipients).forEach((addr) => recipientsSet.add(addr));
          }
        });
      }
    } catch (fetchError) {
      console.warn(`[IMAP] Batch fetch error: ${fetchError}`);
    } finally {
      await imap.logout();
    }

    const processed = endAt - startFrom + 1;
    const hasMore = endAt < totalMailboxMessages;

    return {
      senders: sendersSet,
      recipients: recipientsSet,
      processed,
      hasMore,
      nextOffset: hasMore ? endAt + 1 : undefined,
    };
  }

  /**
   * Legacy job management methods for backward compatibility
   */
  static updateIMAPJob(jobId: string, updates: any): void {
    BaseScanner.updateJob(jobId, updates);
  }

  static getIMAPJob(jobId: string): any {
    return BaseScanner.getJob(jobId);
  }
}
