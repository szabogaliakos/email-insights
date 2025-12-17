import {
  ScanRepository,
  FirestoreScanRepository,
  InMemoryScanRepository,
  NoOpScanRepository,
} from "../scan-repository";
import { ScanProgress } from "../base-scanner";

describe("ScanRepository Implementations", () => {
  const mockProgress: ScanProgress = {
    userEmail: "test@example.com",
    scannerType: "imap",
    lastMessageScanned: 1000,
    totalMessages: 5000,
    contactsFound: 150,
    chunksCompleted: 5,
    isComplete: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe("InMemoryScanRepository", () => {
    let repository: InMemoryScanRepository;

    beforeEach(() => {
      repository = new InMemoryScanRepository();
    });

    it("should save and load progress", async () => {
      await repository.saveProgress("test@example.com", "imap", mockProgress);
      const loaded = await repository.loadProgress("test@example.com", "imap");

      expect(loaded).toEqual(mockProgress);
    });

    it("should return null for non-existent progress", async () => {
      const loaded = await repository.loadProgress("nonexistent@example.com", "imap");
      expect(loaded).toBeNull();
    });

    it("should clear all stored progress", async () => {
      await repository.saveProgress("test@example.com", "imap", mockProgress);
      repository.clear();

      const loaded = await repository.loadProgress("test@example.com", "imap");
      expect(loaded).toBeNull();
    });
  });

  describe("NoOpScanRepository", () => {
    let repository: NoOpScanRepository;

    beforeEach(() => {
      repository = new NoOpScanRepository();
    });

    it("should not throw on saveProgress", async () => {
      await expect(repository.saveProgress("test@example.com", "imap", mockProgress)).resolves.toBeUndefined();
    });

    it("should return null on loadProgress", async () => {
      const loaded = await repository.loadProgress("test@example.com", "imap");
      expect(loaded).toBeNull();
    });
  });

  describe("FirestoreScanRepository", () => {
    let repository: FirestoreScanRepository;
    let mockFirestore: any;

    beforeEach(() => {
      mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockProgress,
        }),
      };

      repository = new FirestoreScanRepository(mockFirestore);
    });

    it("should save progress to Firestore", async () => {
      await repository.saveProgress("test@example.com", "imap", mockProgress);

      expect(mockFirestore.collection).toHaveBeenCalledWith("scanProgress");
      expect(mockFirestore.doc).toHaveBeenCalledWith("test@example.com_imap");
      expect(mockFirestore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProgress,
          updatedAt: expect.any(String),
        })
      );
    });

    it("should load progress from Firestore", async () => {
      const loaded = await repository.loadProgress("test@example.com", "imap");

      expect(loaded).toEqual(mockProgress);
      expect(mockFirestore.collection).toHaveBeenCalledWith("scanProgress");
      expect(mockFirestore.doc).toHaveBeenCalledWith("test@example.com_imap");
    });

    it("should return null when document doesn't exist", async () => {
      mockFirestore.get.mockResolvedValueOnce({
        exists: false,
      });

      const loaded = await repository.loadProgress("test@example.com", "imap");
      expect(loaded).toBeNull();
    });

    it("should handle Firestore errors gracefully", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockFirestore.set.mockRejectedValueOnce(new Error("Firestore error"));

      // Should not throw, just log warning
      await expect(repository.saveProgress("test@example.com", "imap", mockProgress)).resolves.toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
