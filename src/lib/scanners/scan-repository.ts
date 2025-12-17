/**
 * Repository interface for scanner progress persistence
 * Follows Dependency Inversion Principle for testability and flexibility
 */

import { ScanProgress } from "./base-scanner";

export interface ScanRepository {
  /**
   * Save scan progress to persistent storage
   */
  saveProgress(email: string, scannerType: string, progress: ScanProgress): Promise<void>;

  /**
   * Load scan progress from persistent storage
   */
  loadProgress(email: string, scannerType: string): Promise<ScanProgress | null>;
}

/**
 * Firestore implementation of ScanRepository
 */
export class FirestoreScanRepository implements ScanRepository {
  constructor(private firestore: any) {}

  async saveProgress(email: string, scannerType: string, progress: ScanProgress): Promise<void> {
    try {
      const now = new Date().toISOString();
      const progressWithTimestamps = {
        ...progress,
        userEmail: email,
        scannerType,
        updatedAt: now,
      };
      await this.firestore.collection("scanProgress").doc(`${email}_${scannerType}`).set(progressWithTimestamps);
    } catch (error: any) {
      console.warn(`Failed to save scan progress: ${error.message}`);
    }
  }

  async loadProgress(email: string, scannerType: string): Promise<ScanProgress | null> {
    try {
      const doc = await this.firestore.collection("scanProgress").doc(`${email}_${scannerType}`).get();
      return doc.exists ? (doc.data() as ScanProgress) : null;
    } catch (error: any) {
      console.warn(`Failed to load scan progress: ${error.message}`);
      return null;
    }
  }
}

/**
 * In-memory implementation for testing or when persistence is disabled
 */
export class InMemoryScanRepository implements ScanRepository {
  private storage = new Map<string, ScanProgress>();

  async saveProgress(email: string, scannerType: string, progress: ScanProgress): Promise<void> {
    const key = `${email}_${scannerType}`;
    this.storage.set(key, { ...progress });
  }

  async loadProgress(email: string, scannerType: string): Promise<ScanProgress | null> {
    const key = `${email}_${scannerType}`;
    return this.storage.get(key) || null;
  }

  /**
   * Clear all stored progress (useful for testing)
   */
  clear(): void {
    this.storage.clear();
  }
}

/**
 * No-op repository for when persistence is disabled
 */
export class NoOpScanRepository implements ScanRepository {
  async saveProgress(): Promise<void> {
    // Do nothing
  }

  async loadProgress(): Promise<ScanProgress | null> {
    return null;
  }
}

/**
 * Factory function to create appropriate repository based on configuration
 */
export function createScanRepository(
  type: "firestore" | "memory" | "none" = "firestore",
  firestore?: any
): ScanRepository {
  switch (type) {
    case "firestore":
      if (!firestore) {
        throw new Error("Firestore instance required for firestore repository");
      }
      return new FirestoreScanRepository(firestore);
    case "memory":
      return new InMemoryScanRepository();
    case "none":
      return new NoOpScanRepository();
    default:
      throw new Error(`Unknown repository type: ${type}`);
  }
}
