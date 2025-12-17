/**
 * Base scanner functionality for Gmail contact scanning
 */

// In-memory storage for job progress (in production, use Redis or database)
export const scannerJobs = new Map<string, any>();

export interface ContactScanResult {
  senders: string[];
  recipients: string[];
  messageCount: number;
}

export interface ScanResult {
  senders: string[];
  recipients: string[];
  merged: string[];
  scanned: number;
  contacts: number;
  message: string;
  lastMessageScanned: number | string | null | undefined;
}

export interface IMAPScanResult extends Omit<ScanResult, "lastMessageScanned"> {
  lastMessageScanned: number;
}

export interface GmailAPIScanResult extends Omit<ScanResult, "lastMessageScanned"> {
  lastMessageScanned: string | null | undefined;
}

export interface ScanOptions {
  maxMessages?: number;
  mailbox?: string;
  query?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface BatchResult {
  senders: Set<string>;
  recipients: Set<string>;
  processed: number;
  hasMore: boolean;
  nextOffset?: number | string;
}

/**
 * Abstract base class for Gmail contact scanners
 */
export abstract class BaseScanner {
  /**
   * Scan messages asynchronously with progress tracking
   */
  static async scanAsync(
    refreshToken: string,
    email: string,
    jobId: string,
    scanner: BaseScanner,
    options: ScanOptions = {}
  ): Promise<ScanResult> {
    // Initialize job
    BaseScanner.updateJob(jobId, {
      status: "running",
      startedAt: new Date().toISOString(),
      userEmail: email,
    });

    try {
      // Initialize scanning state
      const sendersSet = new Set<string>();
      const recipientsSet = new Set<string>();
      let totalProcessed = 0;
      let nextOffset: number | string | undefined;

      // Start scanning loop
      while (true) {
        // Check if job was cancelled
        const currentJob = BaseScanner.getJob(jobId);
        if (currentJob?.status === "cancelled") {
          console.log(`[${scanner.constructor.name}] Job ${jobId} cancelled, stopping scan`);
          return BaseScanner.createCancelledResult(sendersSet, recipientsSet, totalProcessed);
        }

        // Perform batch scan
        const batchResult = await scanner.scanBatch(refreshToken, email, {
          ...options,
          offset: nextOffset,
        });

        // Add batch results
        batchResult.senders.forEach((addr) => sendersSet.add(addr));
        batchResult.recipients.forEach((addr) => recipientsSet.add(addr));
        totalProcessed += batchResult.processed;

        // Update progress
        const percentComplete = options.maxMessages
          ? Math.min(Math.round((totalProcessed / options.maxMessages) * 100), 100)
          : 0;

        BaseScanner.updateJob(jobId, {
          processedMessages: totalProcessed,
          percentComplete: percentComplete,
          contactsFound: sendersSet.size + recipientsSet.size,
          message: `Processed ${totalProcessed} messages (${percentComplete}%) - Found ${
            sendersSet.size + recipientsSet.size
          } contacts`,
        });

        // Check if we have more to process
        if (!batchResult.hasMore) {
          break;
        }

        nextOffset = batchResult.nextOffset;

        // Rate limiting delay between batches
        if (options.delayBetweenBatches) {
          await new Promise((resolve) => setTimeout(resolve, options.delayBetweenBatches));
        }
      }

      // Create final result
      const senders = Array.from(sendersSet);
      const recipients = Array.from(recipientsSet);
      const merged = Array.from(new Set([...senders, ...recipients]));

      return {
        senders,
        recipients,
        merged,
        scanned: totalProcessed,
        contacts: merged.length,
        message: `${scanner.constructor.name} scan complete: Found ${merged.length} unique contacts from ${totalProcessed} messages`,
        lastMessageScanned: nextOffset,
      };
    } catch (error: any) {
      BaseScanner.updateJob(jobId, {
        status: "failed",
        error: error.message,
        completedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Abstract method for scanning a batch of messages
   */
  protected abstract scanBatch(
    refreshToken: string,
    email: string,
    options: ScanOptions & { offset?: number | string }
  ): Promise<BatchResult>;

  /**
   * Extract email addresses from address objects (common utility)
   */
  protected extractEmailsFromAddresses(addresses: any[]): string[] {
    if (!addresses || !Array.isArray(addresses)) return [];

    return addresses.filter((addr) => addr?.address).map((addr) => addr.address.toLowerCase());
  }

  /**
   * Extract email addresses from header strings (common utility)
   */
  protected extractEmailsFromHeader(header: string): string[] {
    if (!header) return [];

    const emails: string[] = [];

    // Split by common separators
    const parts = header.split(/[,;]/);

    parts.forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      // Extract email from angle brackets if present: "Name <email@example.com>"
      const angleMatch = trimmed.match(/<([^>]+)>/);
      if (angleMatch) {
        emails.push(angleMatch[1].toLowerCase());
      } else {
        // Try to find plain email addresses
        const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          emails.push(emailMatch[1].toLowerCase());
        }
      }
    });

    return emails;
  }

  /**
   * Update job status (shared across all scanners)
   */
  static updateJob(jobId: string, updates: any): void {
    const existing = scannerJobs.get(jobId) || {
      jobId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    scannerJobs.set(jobId, { ...existing, ...updates });
  }

  /**
   * Get job status (shared across all scanners)
   */
  static getJob(jobId: string): any {
    return scannerJobs.get(jobId) || null;
  }

  /**
   * Create cancelled result (shared utility)
   */
  private static createCancelledResult(
    sendersSet: Set<string>,
    recipientsSet: Set<string>,
    processed: number
  ): ScanResult {
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
      lastMessageScanned: null,
    };
  }
}
