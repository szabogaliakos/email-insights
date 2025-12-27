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
   * Get available mailbox names to try for Gmail IMAP
   */
  private static getGmailMailboxCandidates(): string[] {
    return [
      "[Gmail]/Összes levél",
      "[Gmail]/&ANY-sszes lev&AOk-l",
      "[Gmail]/All Mail", // Most common
      "[Gmail]/AllMail", // Alternative spelling
      "INBOX", // Standard IMAP inbox
      "[Google Mail]/All Mail", // Alternative format
      "Archive", // Some accounts use this
    ];
  }

  /**
   * Try to find a working mailbox for Gmail IMAP scanning
   */
  private static async findWorkingMailbox(imap: any, preferredMailbox?: string): Promise<string> {
    const candidates = preferredMailbox
      ? [preferredMailbox, ...this.getGmailMailboxCandidates().filter((m) => m !== preferredMailbox)]
      : this.getGmailMailboxCandidates();

    for (const mailboxName of candidates) {
      try {
        console.log(`[IMAP] Trying mailbox: "${mailboxName}"`);
        await imap.mailboxOpen(mailboxName);

        // If we get here, the mailbox opened successfully
        console.log(`[IMAP] Successfully opened mailbox: "${mailboxName}"`);
        return mailboxName;
      } catch (error: any) {
        console.log(`[IMAP] Mailbox "${mailboxName}" failed: ${error.message}`);
        // Continue to next candidate
      }
    }

    throw new Error(`No working mailbox found. Tried: ${candidates.join(", ")}`);
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
    const preferredMailbox = imapSettings?.mailbox; // User's preferred mailbox if set

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
    let status: any = null;
    let totalMessages = 0;
    let processed = 0;
    let mailbox: string | undefined;

    try {
      console.log(`[IMAP] Connecting to ${imapConfig.host}:${imapConfig.port} for ${email}...`);
      await imap.connect();
      console.log(`[IMAP] Connected successfully, finding working mailbox...`);

      // Find a working mailbox (try preferred first, then fallbacks)
      mailbox = await this.findWorkingMailbox(imap, preferredMailbox);

      // Get status to know how many messages there are
      status = await imap.status(mailbox, { messages: true });
      totalMessages = Math.min(status.messages || 0, maxMessages);

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
          // Enhanced batch error logging with structured JSON for Cloud Logging
          const batchErrorLog = {
            severity: "WARNING",
            message: "[IMAP] Detailed batch fetch error",
            error:
              fetchError instanceof Error
                ? {
                    message: fetchError.message,
                    stack: fetchError.stack,
                    name: fetchError.name,
                  }
                : fetchError,
            email,
            batchInfo: {
              startSeq,
              endSeq,
              currentBatchSize,
              mailbox,
              totalMessages,
            },
            imapConfig: {
              host: imapConfig.host,
              port: imapConfig.port,
              secure: imapConfig.secure,
              authMethod: imapSettings?.enabled && imapSettings?.appPassword ? "app_password" : "oauth",
            },
            timestamp: new Date().toISOString(),
          };

          console.log(JSON.stringify(batchErrorLog));
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
      // Enhanced error logging with structured JSON for Cloud Logging
      const errorLog = {
        severity: "ERROR",
        message: "[IMAP] Detailed scan error",
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        email,
        imapConfig: {
          host: imapConfig.host,
          port: imapConfig.port,
          secure: imapConfig.secure,
          authMethod: imapSettings?.enabled && imapSettings?.appPassword ? "app_password" : "oauth",
          mailbox,
          maxMessages,
        },
        status: status
          ? {
              messages: status.messages,
              totalMessages,
              processed,
            }
          : null,
        timestamp: new Date().toISOString(),
      };

      console.log(JSON.stringify(errorLog));

      await imap.logout().catch(() => {}); // Ignore logout errors
      throw new Error(`IMAP scanning failed: ${error instanceof Error ? error.message : String(error)}`);
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

    // Declare variables for error logging scope
    let batchStartFrom = startFrom;
    let batchEndAt = endAt;
    let batchMessagesInThisBatch = messagesInThisBatch;
    let batchTotalMailboxMessages = totalMailboxMessages;

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
      // Enhanced batch error logging with structured JSON for Cloud Logging
      const batchErrorLog = {
        severity: "WARNING",
        message: "[IMAP] Detailed batch fetch error",
        error:
          fetchError instanceof Error
            ? {
                message: fetchError.message,
                stack: fetchError.stack,
                name: fetchError.name,
              }
            : fetchError,
        email,
        batchInfo: {
          startFrom: batchStartFrom,
          endAt: batchEndAt,
          messagesInThisBatch: batchMessagesInThisBatch,
          mailbox,
          totalMailboxMessages: batchTotalMailboxMessages,
        },
        imapConfig: {
          host: imapConfig.host,
          port: imapConfig.port,
          secure: imapConfig.secure,
          authMethod: imapSettings?.enabled && imapSettings?.appPassword ? "app_password" : "oauth",
        },
        timestamp: new Date().toISOString(),
      };

      console.log(JSON.stringify(batchErrorLog));
      // Continue with next batch rather than fail entirely
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
