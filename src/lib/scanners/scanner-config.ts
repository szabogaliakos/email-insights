/**
 * Centralized scanner configuration
 * Easy to modify scanner parameters from one place
 */

export interface ScannerConfig {
  // Message limits
  maxMessages: number;

  // IMAP-specific
  mailbox?: string;

  // Performance tuning
  batchSize: number;
  delayBetweenBatches: number;

  // Features
  usePersistence: boolean;
  scannerType: "imap" | "gmail-api";

  // Gmail API specific
  query?: string;
}

/**
 * Default configurations for each scanner type
 * Modify these values to change scanner behavior globally
 */
export const SCANNER_CONFIGS = {
  imap: {
    // Message limits - increase for larger mailboxes
    maxMessages: 10000, // How many messages to scan total

    // IMAP mailbox to scan
    mailbox: "[Gmail]/All Mail", // Can be "INBOX", "[Gmail]/Sent Mail", etc.

    // Performance optimization - larger batches for IMAP speed
    batchSize: 1000, // Messages per batch (IMAP can handle large batches)
    delayBetweenBatches: 100, // Minimal delay between batches (IMAP is fast)

    // Features
    usePersistence: true, // Save progress to Firestore for resumability
    scannerType: "imap" as const,
  },

  gmailApi: {
    // Message limits - Gmail API has stricter limits
    maxMessages: 2000, // Gmail API quota limits

    // Gmail API query (optional) - e.g., "newer_than:1y" for recent emails
    query: "", // Empty string = all messages

    // Performance optimization - smaller batches for API rate limits
    batchSize: 50, // Messages per batch (API rate limiting)
    delayBetweenBatches: 1000, // 1 second delay to respect API limits

    // Features
    usePersistence: true, // Save progress to Firestore for resumability
    scannerType: "gmail-api" as const,
  } satisfies ScannerConfig,
} as const;

/**
 * Get scanner configuration with optional overrides
 * Usage: getScannerConfig('imap', { maxMessages: 10000 })
 */
export function getScannerConfig(
  scannerType: keyof typeof SCANNER_CONFIGS,
  overrides: Partial<ScannerConfig> = {}
): ScannerConfig {
  const baseConfig = SCANNER_CONFIGS[scannerType];
  return { ...baseConfig, ...overrides };
}

/**
 * Quick access functions for common configurations
 */
export const getIMAPConfig = (overrides?: Partial<ScannerConfig>) => getScannerConfig("imap", overrides);

export const getGmailAPIConfig = (overrides?: Partial<ScannerConfig>) => getScannerConfig("gmailApi", overrides);

/**
 * Configuration presets for different use cases
 */
export const SCANNER_PRESETS = {
  // Fast IMAP scan for testing
  imapFast: getIMAPConfig({ maxMessages: 1000, batchSize: 100 }),

  // Thorough IMAP scan
  imapThorough: getIMAPConfig({ maxMessages: 100000, batchSize: 2000 }),

  // Recent Gmail API scan
  gmailRecent: getGmailAPIConfig({
    maxMessages: 1000,
    query: "newer_than:30d",
  }),

  // Full Gmail API scan
  gmailFull: getGmailAPIConfig({ maxMessages: 2000 }),
} as const;
