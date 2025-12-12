import { Firestore } from "@google-cloud/firestore";

let firestore: Firestore | null = null;

const requiredEnv = ["FIRESTORE_PROJECT_ID", "FIRESTORE_CLIENT_EMAIL", "FIRESTORE_PRIVATE_KEY"] as const;

function assertEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Firestore env vars: ${missing.join(", ")}. Add them in Vercel and .env.local.`);
  }
}

function parsePrivateKey(key: string | undefined): string {
  if (!key) throw new Error("FIRESTORE_PRIVATE_KEY is missing");

  // Handle both escaped and unescaped newlines
  // Replace \\n (escaped) with actual newlines
  // Also handle if it's already a multi-line string
  const parsed = key.replace(/\\n/g, "\n");

  // Ensure it starts and ends correctly
  if (!parsed.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Invalid private key format: missing BEGIN PRIVATE KEY");
  }

  return parsed;
}

export function getFirestore() {
  if (firestore) return firestore;
  assertEnv();

  try {
    const privateKey = parsePrivateKey(process.env.FIRESTORE_PRIVATE_KEY);

    // Only set databaseId if explicitly provided and not "(default)"
    const databaseId = process.env.FIRESTORE_DATABASE_ID;
    const dbConfig: any = {
      projectId: process.env.FIRESTORE_PROJECT_ID,
      credentials: {
        client_email: process.env.FIRESTORE_CLIENT_EMAIL,
        private_key: privateKey,
      },
    };

    // Only add databaseId if it's set and not the literal "(default)"
    if (databaseId && databaseId !== "(default)" && databaseId.trim() !== "") {
      dbConfig.databaseId = databaseId;
    }

    firestore = new Firestore(dbConfig);

    return firestore;
  } catch (error: any) {
    throw new Error(`Failed to initialize Firestore: ${error.message}. Check your FIRESTORE_PRIVATE_KEY format.`);
  }
}

export type ContactSnapshot = {
  senders: string[];
  recipients: string[];
  merged: string[];
  messageSampleCount: number;
  updatedAt: string;
};

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
  color?: {
    textColor: string;
    backgroundColor: string;
  };
  // Gmail API fields
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  messageListVisibility?: "show" | "hide";
  threadsTotal?: number;
  threadsUnread?: number;
  messagesTotal?: number;
  messagesUnread?: number;
  // Hierarchy
  parentId?: string;
  childrenIds?: string[];
  // Stored fields
  createdAt?: string;
  updatedAt?: string;
};

export async function saveContactSnapshot(email: string, snapshot: ContactSnapshot) {
  try {
    const db = getFirestore();
    await db.collection("gmailContacts").doc(email).set(snapshot, { merge: true });
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      throw new Error(
        "Firestore database not found. Please ensure:\n" +
          "1. Firestore API is enabled in Google Cloud Console\n" +
          "2. A Firestore database exists in your project\n" +
          "3. Your service account has proper permissions"
      );
    }
    throw error;
  }
}

export async function loadContactSnapshot(email: string) {
  try {
    const db = getFirestore();
    const doc = await db.collection("gmailContacts").doc(email).get();
    return doc.exists ? (doc.data() as ContactSnapshot) : null;
  } catch (error: any) {
    // Handle NOT_FOUND - document doesn't exist is fine, return null
    if (error.code === 5 || error.code === "NOT_FOUND") {
      // This might be a database-level NOT_FOUND, but we'll treat it as no data
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

export async function saveLabels(email: string, labels: GmailLabel[]) {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const labelsRef = db.collection("gmailLabels").doc(email).collection("labels");

    // Delete existing labels
    const existingDocs = await labelsRef.get();
    existingDocs.forEach((doc) => batch.delete(doc.ref));

    // Save new labels
    labels.forEach((label) => {
      batch.set(labelsRef.doc(label.id), label);
    });

    await batch.commit();
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      throw new Error(
        "Firestore database not found. Please ensure:\n" +
          "1. Firestore API is enabled in Google Cloud Console\n" +
          "2. A Firestore database exists in your project\n" +
          "3. Your service account has proper permissions"
      );
    }
    throw error;
  }
}

export async function loadLabels(email: string): Promise<GmailLabel[]> {
  try {
    const db = getFirestore();
    const snapshot = await db.collection("gmailLabels").doc(email).collection("labels").get();
    return snapshot.docs.map((doc) => doc.data() as GmailLabel);
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      return [];
    }
    throw error;
  }
}

function sanitizeData<T extends Record<string, any>>(data: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  return result;
}

export async function saveLabel(email: string, label: GmailLabel) {
  try {
    const db = getFirestore();
    // Remove undefined properties before saving to Firestore
    const sanitizedLabel = sanitizeData(label);
    await db.collection("gmailLabels").doc(email).collection("labels").doc(label.id).set(sanitizedLabel);
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      throw new Error(
        "Firestore database not found. Please ensure:\n" +
          "1. Firestore API is enabled in Google Cloud Console\n" +
          "2. A Firestore database exists in your project\n" +
          "3. Your service account has proper permissions"
      );
    }
    throw error;
  }
}

export async function deleteLabel(email: string, labelId: string) {
  try {
    const db = getFirestore();
    await db.collection("gmailLabels").doc(email).collection("labels").doc(labelId).delete();
  } catch (error) {
    throw error;
  }
}

export type GmailFilter = {
  id: string;
  name: string;
  query: string;
  labelIds?: string[];
  archive?: boolean;
  gmailId?: string; // ID when saved to Gmail
  createdAt: string;
  updatedAt: string;
  // Status tracking
  status: "draft" | "published"; // draft = saved in firestore, published = also in Gmail
};

export async function saveFilter(email: string, filter: GmailFilter) {
  try {
    const db = getFirestore();
    // Remove undefined properties before saving to Firestore
    const sanitizedFilter = sanitizeData(filter);
    await db.collection("gmailFilters").doc(email).collection("filters").doc(filter.id).set(sanitizedFilter);
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      throw new Error(
        "Firestore database not found. Please ensure:\n" +
          "1. Firestore API is enabled in Google Cloud Console\n" +
          "2. A Firestore database exists in your project\n" +
          "3. Your service account has proper permissions"
      );
    }
    throw error;
  }
}

export async function saveFilters(email: string, filters: GmailFilter[]) {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const filtersRef = db.collection("gmailFilters").doc(email).collection("filters");

    // Delete existing filters
    const existingDocs = await filtersRef.get();
    existingDocs.forEach((doc) => batch.delete(doc.ref));

    // Save new filters
    filters.forEach((filter) => {
      batch.set(filtersRef.doc(filter.id), sanitizeData(filter));
    });

    await batch.commit();
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      throw new Error(
        "Firestore database not found. Please ensure:\n" +
          "1. Firestore API is enabled in Google Cloud Console\n" +
          "2. A Firestore database exists in your project\n" +
          "3. Your service account has proper permissions"
      );
    }
    throw error;
  }
}

export async function loadFilters(email: string): Promise<GmailFilter[]> {
  try {
    const db = getFirestore();
    const snapshot = await db.collection("gmailFilters").doc(email).collection("filters").get();
    return snapshot.docs.map((doc) => doc.data() as GmailFilter);
  } catch (error: any) {
    if (error.code === 5 || error.code === "NOT_FOUND") {
      return [];
    }
    throw error;
  }
}

export async function deleteFilter(email: string, filterId: string) {
  try {
    const db = getFirestore();
    await db.collection("gmailFilters").doc(email).collection("filters").doc(filterId).delete();
  } catch (error) {
    throw error;
  }
}
