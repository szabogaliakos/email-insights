import { IMAPHeaderScanner } from "../imap-header-scanner";
import { InMemoryScanRepository } from "../scan-repository";

// Mock the firestore module
jest.mock("../../firestore", () => ({
  loadIMAPSettings: jest.fn(),
}));

// Mock the google module for IMAP access token
jest.mock("../../google", () => ({
  getGmailClient: jest.fn(),
}));

describe("IMAPHeaderScanner", () => {
  let scanner: IMAPHeaderScanner;
  let mockRepository: InMemoryScanRepository;
  let mockLoadIMAPSettings: jest.MockedFunction<any>;
  let mockGetGmailClient: jest.MockedFunction<any>;

  beforeEach(() => {
    mockRepository = new InMemoryScanRepository();
    scanner = new IMAPHeaderScanner();
    // Inject our test repository
    (scanner as any).repository = mockRepository;

    // Get the mocked functions
    mockLoadIMAPSettings = require("../../firestore").loadIMAPSettings;
    mockGetGmailClient = require("../../google").getGmailClient;

    // Default mock implementations
    mockLoadIMAPSettings.mockResolvedValue({
      mailbox: "[Gmail]/All Mail",
      maxMessages: 10000,
    });

    mockGetGmailClient.mockResolvedValue({
      auth: {
        getAccessToken: jest.fn().mockResolvedValue({ token: "mock-imap-token" }),
      },
      gmail: {},
      email: "test@example.com",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("scanHeadersAsync", () => {
    it("should scan messages with IMAP", async () => {
      const result = await IMAPHeaderScanner.scanHeadersAsync("refresh-token", "test@example.com", "job-123");

      expect(result.scanned).toBeGreaterThan(0);
      expect(result.contacts).toBeGreaterThan(0);
      expect(result.senders).toContain("sender@example.com");
      expect(result.recipients).toContain("recipient@example.com");
    });
  });

  describe("scanBatch", () => {
    beforeEach(() => {
      scanner = new IMAPHeaderScanner();
      (scanner as any).repository = mockRepository;
    });

    it("should process a batch of IMAP messages", async () => {
      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 50,
        mailbox: "[Gmail]/All Mail",
      });

      expect(result.processed).toBe(50); // Mock returns 100 messages, batch size 50
      expect(result.senders).toContain("sender@example.com");
      expect(result.recipients).toContain("recipient@example.com");
      expect(result.hasMore).toBe(true); // 100 total messages > 50 processed
      expect(result.nextOffset).toBe(51);
    });

    it("should handle mailbox settings from IMAP config", async () => {
      mockLoadIMAPSettings.mockResolvedValue({
        mailbox: "INBOX",
        maxMessages: 5000,
      });

      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 100,
      });

      expect(mockLoadIMAPSettings).toHaveBeenCalledWith("test@example.com");
      expect(result.processed).toBeGreaterThan(0);
    });

    it("should handle end of mailbox", async () => {
      // Mock IMAP status to return fewer messages than requested
      const mockImapFlow = global.testUtils.createMockIMAPConnection();
      mockImapFlow.status.mockResolvedValue({ messages: 50 }); // Only 50 messages total

      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 100, // Request 100, but only 50 available
        offset: 40, // Start from message 40
      });

      expect(result.processed).toBeGreaterThan(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextOffset).toBeUndefined();
    });
  });

  describe("Email extraction", () => {
    beforeEach(() => {
      scanner = new IMAPHeaderScanner();
      (scanner as any).repository = mockRepository;
    });

    it("should extract emails from IMAP address objects", () => {
      const addresses = [{ address: "sender@example.com" }, { address: "recipient@example.com" }];

      const result = scanner.extractEmailsFromAddresses(addresses);
      expect(result).toEqual(["sender@example.com", "recipient@example.com"]);
    });

    it("should handle malformed address objects", () => {
      const addresses = [{ address: "valid@example.com" }, { noAddress: true }, null, { address: "" }];

      const result = scanner.extractEmailsFromAddresses(addresses);
      expect(result).toEqual(["valid@example.com"]);
    });

    it("should handle empty or invalid address arrays", () => {
      expect(scanner.extractEmailsFromAddresses([])).toEqual([]);
      expect(scanner.extractEmailsFromAddresses(null as any)).toEqual([]);
      expect(scanner.extractEmailsFromAddresses(undefined as any)).toEqual([]);
    });
  });

  describe("IMAP Authentication", () => {
    it("should use app password when configured", async () => {
      mockLoadIMAPSettings.mockResolvedValue({
        enabled: true,
        setupCompleted: true,
        appPassword: "encrypted-password",
      });

      // Mock password decryption
      jest.doMock("../../crypto", () => ({
        PasswordEncryption: {
          decrypt: jest.fn().mockReturnValue("decrypted-password"),
        },
      }));

      const result = await IMAPHeaderScanner.scanHeadersAsync("refresh-token", "test@example.com", "job-123");

      expect(result.scanned).toBeGreaterThan(0);
    });

    it("should fallback to OAuth when app password not configured", async () => {
      mockLoadIMAPSettings.mockResolvedValue({
        enabled: false,
      });

      const result = await IMAPHeaderScanner.scanHeadersAsync("refresh-token", "test@example.com", "job-123");

      expect(mockGetGmailClient).toHaveBeenCalledWith("refresh-token");
      expect(result.scanned).toBeGreaterThan(0);
    });
  });

  describe("Legacy compatibility", () => {
    it("should maintain updateIMAPJob method", () => {
      expect(typeof IMAPHeaderScanner.updateIMAPJob).toBe("function");

      IMAPHeaderScanner.updateIMAPJob("job-123", { status: "completed" });
      // Should not throw
    });

    it("should maintain getIMAPJob method", () => {
      expect(typeof IMAPHeaderScanner.getIMAPJob).toBe("function");

      const job = IMAPHeaderScanner.getIMAPJob("job-123");
      expect(job).toBeDefined();
    });
  });
});
