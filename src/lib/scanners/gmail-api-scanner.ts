import { getGmailClient } from "../google";
import { BaseScanner, ScanResult, ScanOptions, BatchResult } from "./base-scanner";
import { getGmailAPIConfig } from "./scanner-config";

/**
 * Gmail API-based contact scanner
 */
export class GmailAPIScanner extends BaseScanner {
  /**
   * Unified async scanning method using BaseScanner
   */
  static async scanMessagesAPI(
    refreshToken: string,
    email: string,
    jobId: string,
    maxMessages: number = 2000,
    query: string = ""
  ): Promise<ScanResult> {
    const scanner = new GmailAPIScanner();
    const config = getGmailAPIConfig({ maxMessages, query }); // Use centralized config with overrides
    return BaseScanner.scanAsync(refreshToken, email, jobId, scanner, config);
  }

  /**
   * Implement the abstract scanBatch method for Gmail API
   */
  protected async scanBatch(
    refreshToken: string,
    email: string,
    options: ScanOptions & { offset?: number | string }
  ): Promise<BatchResult> {
    const { gmail } = await getGmailClient(refreshToken);
    const batchSize = options.batchSize || 50;
    const query = options.query || "";

    // Get message IDs
    const messagesList = await gmail.users.messages.list({
      userId: "me",
      maxResults: batchSize,
      pageToken: options.offset as string,
      q: query,
    });

    const messageIds = messagesList.data.messages?.map((msg) => msg.id).filter(Boolean) || [];
    const nextPageToken = messagesList.data.nextPageToken;

    if (messageIds.length === 0) {
      return {
        senders: new Set(),
        recipients: new Set(),
        processed: 0,
        hasMore: false,
      };
    }

    // Get message details in parallel but with rate limiting consideration
    const messagePromises = messageIds.map(async (id, index) => {
      // Add slight staggering to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, index * 10));

      try {
        const response = await gmail.users.messages.get({
          userId: "me",
          id: id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Bcc"],
        });
        return response.data;
      } catch (error) {
        console.warn(`[Gmail API] Failed to fetch message ${id}:`, error);
        return null;
      }
    });

    const messages = await Promise.all(messagePromises);

    // Process the messages we got
    const sendersSet = new Set<string>();
    const recipientsSet = new Set<string>();

    messages.forEach((message) => {
      if (!message || !message.payload) return;

      // Extract headers
      const headers = message.payload.headers || [];

      const getHeader = (name: string): string | undefined => {
        return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
      };

      const from = getHeader("From");
      const to = getHeader("To");
      const cc = getHeader("Cc");
      const bcc = getHeader("Bcc");

      // Extract email addresses using shared utility
      if (from) {
        this.extractEmailsFromHeader(from).forEach((addr) => sendersSet.add(addr));
      }

      [to, cc, bcc].filter(Boolean).forEach((header) => {
        if (header) {
          this.extractEmailsFromHeader(header).forEach((addr) => recipientsSet.add(addr));
        }
      });
    });

    return {
      senders: sendersSet,
      recipients: recipientsSet,
      processed: messageIds.length,
      hasMore: !!nextPageToken,
      nextOffset: nextPageToken || undefined,
    };
  }

  /**
   * Legacy job management methods for backward compatibility
   */
  static updateGmailApiJob(jobId: string, updates: any): void {
    BaseScanner.updateJob(jobId, updates);
  }

  static getGmailApiJob(jobId: string): any {
    return BaseScanner.getJob(jobId);
  }
}
