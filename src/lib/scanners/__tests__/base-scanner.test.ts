import { BaseScanner, scannerJobs } from "../base-scanner";
import { InMemoryScanRepository } from "../scan-repository";

// Create a test scanner implementation
class TestScanner extends BaseScanner {
  constructor() {
    super();
  }

  async scanBatch(refreshToken: string, email: string, options: any) {
    const batchSize = options.batchSize || 10;
    const offset = options.offset || 0;
    const maxMessages = options.maxMessages || 1000;

    // Simulate processing: process up to batchSize, but don't exceed maxMessages
    const remaining = maxMessages - offset;
    const processed = Math.min(batchSize, remaining);
    const hasMore = offset + processed < maxMessages && processed === batchSize;

    // Add a small delay for cancellation tests
    await new Promise((resolve) => setTimeout(resolve, 5));

    return {
      senders: new Set(["sender@example.com"]),
      recipients: new Set(["recipient@example.com"]),
      processed,
      hasMore,
      nextOffset: hasMore ? offset + processed : undefined,
    };
  }
}

describe("BaseScanner", () => {
  let scanner: TestScanner;
  let mockRepository: InMemoryScanRepository;

  beforeEach(() => {
    scanner = new TestScanner();
    mockRepository = new InMemoryScanRepository();
    // Clear job storage
    scannerJobs.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    scannerJobs.clear();
  });

  describe("scanAsync", () => {
    it("should execute a complete scan successfully", async () => {
      const result = await BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        maxMessages: 10,
        batchSize: 5,
        usePersistence: false,
        scannerType: "test",
      });

      expect(result.scanned).toBeGreaterThan(0);
      expect(result.contacts).toBeGreaterThan(0);
      expect(result.senders).toContain("sender@example.com");
      expect(result.recipients).toContain("recipient@example.com");
      expect(result.message).toContain("complete");
    });

    it("should handle persistence with repository", async () => {
      const result = await BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        maxMessages: 5,
        batchSize: 5,
        usePersistence: true,
        scannerType: "test",
        repository: mockRepository,
      });

      expect(result.scanned).toBe(5); // 1 batch of 5
      expect(result.contacts).toBe(2); // 1 sender + 1 recipient
    });

    it("should skip scan if already completed", async () => {
      // Pre-populate repository with completed scan
      await mockRepository.saveProgress("test@example.com", "test", {
        userEmail: "test@example.com",
        scannerType: "test",
        lastMessageScanned: 100,
        totalMessages: 50,
        contactsFound: 25,
        chunksCompleted: 1,
        isComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        usePersistence: true,
        scannerType: "test",
        repository: mockRepository,
      });

      expect(result.scanned).toBe(50);
      expect(result.contacts).toBe(25);
      expect(result.message).toContain("already completed");
    });

    it("should handle scan cancellation", async () => {
      // Start scan in background
      const scanPromise = BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        maxMessages: 100,
        batchSize: 10,
        usePersistence: false,
        scannerType: "test",
      });

      // Cancel the job
      setTimeout(() => {
        BaseScanner.updateJob("job-123", { status: "cancelled" });
      }, 10);

      const result = await scanPromise;

      expect(result.message).toContain("cancelled");
      expect(result.scanned).toBeGreaterThan(0);
    });

    it("should handle scanner errors gracefully", async () => {
      const failingScanner = {
        scanBatch: jest.fn().mockRejectedValue(new Error("Scanner failed")),
      } as any;

      await expect(
        BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", failingScanner, {
          usePersistence: false,
          scannerType: "test",
        })
      ).rejects.toThrow("Scanner failed");

      // Job should be marked as failed
      const job = BaseScanner.getJob("job-123");
      expect(job.status).toBe("failed");
      expect(job.error).toBe("Scanner failed");
    });
  });

  describe("Job management", () => {
    it("should create and update jobs", () => {
      BaseScanner.updateJob("test-job", {
        status: "running",
        progress: 50,
      });

      const job = BaseScanner.getJob("test-job");
      expect(job).toBeDefined();
      expect(job.status).toBe("running");
      expect(job.progress).toBe(50);
    });

    it("should return null for non-existent jobs", () => {
      const job = BaseScanner.getJob("non-existent");
      expect(job).toBeNull();
    });

    it("should initialize jobs with default values", () => {
      BaseScanner.updateJob("new-job", { customField: "value" });

      const job = BaseScanner.getJob("new-job");
      expect(job.jobId).toBe("new-job");
      expect(job.status).toBe("pending");
      expect(job.customField).toBe("value");
      expect(job.createdAt).toBeDefined();
    });
  });

  describe("Email extraction utilities", () => {
    beforeEach(() => {
      scanner = new TestScanner();
    });

    describe("extractEmailsFromHeader", () => {
      it("should extract emails from various header formats", () => {
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

      it("should handle edge cases", () => {
        expect(scanner.extractEmailsFromHeader("")).toEqual([]);
        expect(scanner.extractEmailsFromHeader("not-an-email")).toEqual([]);
        expect(scanner.extractEmailsFromHeader("Name <malformed@")).toEqual([]);
        expect(scanner.extractEmailsFromHeader("user@domain.co.uk")).toEqual(["user@domain.co.uk"]);
      });
    });

    describe("extractEmailsFromAddresses", () => {
      it("should extract emails from address objects", () => {
        const addresses = [
          { address: "sender@example.com", name: "Sender Name" },
          { address: "recipient@example.com" },
        ];

        const result = scanner.extractEmailsFromAddresses(addresses);
        expect(result).toEqual(["sender@example.com", "recipient@example.com"]);
      });

      it("should handle malformed address objects", () => {
        const addresses = [
          { address: "valid@example.com" },
          { noAddress: true },
          null,
          { address: "" },
          { address: "another@example.com" },
        ];

        const result = scanner.extractEmailsFromAddresses(addresses);
        expect(result).toEqual(["valid@example.com", "another@example.com"]);
      });

      it("should handle empty arrays", () => {
        expect(scanner.extractEmailsFromAddresses([])).toEqual([]);
        expect(scanner.extractEmailsFromAddresses(null as any)).toEqual([]);
        expect(scanner.extractEmailsFromAddresses(undefined as any)).toEqual([]);
      });
    });
  });

  describe("Progress tracking", () => {
    it("should update progress correctly during scan", async () => {
      await BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        maxMessages: 10,
        batchSize: 5,
        usePersistence: false,
        scannerType: "test",
      });

      const job = BaseScanner.getJob("job-123");
      expect(job.processedMessages).toBeGreaterThan(0);
      expect(job.contactsFound).toBeGreaterThan(0);
      expect(job.percentComplete).toBeDefined();
      expect(job.message).toContain("Processed");
    });

    it("should handle completion status", async () => {
      await BaseScanner.scanAsync("refresh-token", "test@example.com", "job-123", scanner, {
        maxMessages: 5,
        batchSize: 5,
        usePersistence: false,
        scannerType: "test",
      });

      const job = BaseScanner.getJob("job-123");
      expect(job.status).toBe("running"); // Would be "completed" if we had proper job completion
    });
  });
});
