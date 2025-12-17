import { GmailAPIScanner } from "../gmail-api-scanner";
import { InMemoryScanRepository } from "../scan-repository";

// Mock the google module
jest.mock("../../google", () => ({
  getGmailClient: jest.fn(),
}));

describe("GmailAPIScanner", () => {
  let scanner: GmailAPIScanner;
  let mockRepository: InMemoryScanRepository;
  let mockGetGmailClient: jest.MockedFunction<any>;

  beforeEach(() => {
    mockRepository = new InMemoryScanRepository();
    scanner = new GmailAPIScanner();
    // Inject our test repository
    (scanner as any).repository = mockRepository;

    // Get the mocked function
    mockGetGmailClient = require("../../google").getGmailClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("scanMessagesAPI", () => {
    it("should scan messages with default config", async () => {
      const mockGmailClient = global.testUtils.createMockGmailClient();

      mockGetGmailClient.mockResolvedValue({
        gmail: mockGmailClient,
      });

      const result = await GmailAPIScanner.scanMessagesAPI("refresh-token", "test@example.com", "job-123");

      expect(result.scanned).toBeGreaterThan(0);
      expect(result.contacts).toBeGreaterThan(0);
      expect(result.senders).toContain("sender@example.com");
      expect(result.recipients).toContain("recipient@example.com");

      expect(mockGetGmailClient).toHaveBeenCalledWith("refresh-token");
    });

    it("should handle Gmail API errors gracefully", async () => {
      mockGetGmailClient.mockRejectedValue(new Error("API quota exceeded"));

      await expect(GmailAPIScanner.scanMessagesAPI("refresh-token", "test@example.com", "job-123")).rejects.toThrow(
        "API quota exceeded"
      );
    });

    it("should respect maxMessages parameter", async () => {
      const mockGmailClient = global.testUtils.createMockGmailClient();
      // Override to return many messages
      mockGmailClient.users.messages.list.mockImplementation(({ maxResults }) => {
        const numMessages = Math.min(maxResults || 50, 100); // Respect maxResults but don't exceed 100
        return Promise.resolve({
          data: {
            messages: Array(numMessages)
              .fill(null)
              .map((_, i) => ({ id: `msg${i}` })),
            nextPageToken: undefined,
          },
        });
      });

      mockGmailClient.users.messages.get.mockResolvedValue({
        data: {
          payload: {
            headers: [{ name: "From", value: "sender@example.com" }],
          },
        },
      });

      mockGetGmailClient.mockResolvedValue({
        gmail: mockGmailClient,
      });

      const result = await GmailAPIScanner.scanMessagesAPI(
        "refresh-token",
        "test@example.com",
        "job-123",
        50 // Limit to 50 messages
      );

      expect(result.scanned).toBeLessThanOrEqual(50);
    });
  });

  describe("scanBatch", () => {
    beforeEach(() => {
      scanner = new GmailAPIScanner();
      (scanner as any).repository = mockRepository;
    });

    it("should process a batch of messages", async () => {
      const mockGmailClient = global.testUtils.createMockGmailClient();
      // Configure for pagination
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {
          messages: [{ id: "msg1" }, { id: "msg2" }],
          nextPageToken: "next-page-token",
        },
      });

      mockGmailClient.users.messages.get.mockResolvedValue({
        data: {
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "To", value: "recipient@example.com" },
              { name: "Cc", value: "cc@example.com" },
            ],
          },
        },
      });

      mockGetGmailClient.mockResolvedValue({
        gmail: mockGmailClient,
      });

      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 50,
      });

      expect(result.processed).toBe(2);
      expect(result.senders).toContain("sender@example.com");
      expect(result.recipients).toContain("recipient@example.com");
      expect(result.recipients).toContain("cc@example.com");
      expect(result.hasMore).toBe(true);
      expect(result.nextOffset).toBe("next-page-token");
    });

    it("should handle empty message list", async () => {
      const mockGmailClient = global.testUtils.createMockGmailClient();
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {
          messages: [],
          nextPageToken: undefined,
        },
      });

      mockGetGmailClient.mockResolvedValue({
        gmail: mockGmailClient,
      });

      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 50,
      });

      expect(result.processed).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.senders.size).toBe(0);
      expect(result.recipients.size).toBe(0);
    });

    it("should handle message fetch errors gracefully", async () => {
      const mockGmailClient = global.testUtils.createMockGmailClient();
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {
          messages: [{ id: "msg1" }],
          nextPageToken: undefined,
        },
      });

      mockGmailClient.users.messages.get.mockRejectedValue(new Error("Message not found"));

      mockGetGmailClient.mockResolvedValue({
        gmail: mockGmailClient,
      });

      const result = await scanner.scanBatch("refresh-token", "test@example.com", {
        batchSize: 50,
      });

      // Should continue processing despite individual message errors
      expect(result.processed).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("Email extraction", () => {
    beforeEach(() => {
      scanner = new GmailAPIScanner();
      (scanner as any).repository = mockRepository;
    });

    it("should extract emails from various header formats", () => {
      // Test different email formats
      expect(scanner.extractEmailsFromHeader("sender@example.com")).toEqual(["sender@example.com"]);
      expect(scanner.extractEmailsFromHeader("Name <sender@example.com>")).toEqual(["sender@example.com"]);
      expect(scanner.extractEmailsFromHeader("sender@example.com, recipient@example.com")).toEqual([
        "sender@example.com",
        "recipient@example.com",
      ]);
      expect(scanner.extractEmailsFromHeader("Name <sender@example.com>, Another <recipient@example.com>")).toEqual([
        "sender@example.com",
        "recipient@example.com",
      ]);
    });

    it("should handle malformed headers gracefully", () => {
      expect(scanner.extractEmailsFromHeader("")).toEqual([]);
      expect(scanner.extractEmailsFromHeader("not-an-email")).toEqual([]);
      expect(scanner.extractEmailsFromHeader("Name <malformed")).toEqual([]);
    });
  });
});
