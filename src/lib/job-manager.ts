import { getGmailClient } from "@/lib/google";
import { loadContactSnapshot, saveContactSnapshot, getFirestore } from "@/lib/firestore";
import { extractAddressesFromMessage } from "@/lib/gmail";
import type { gmail_v1 } from "googleapis";

export type JobStatus = "running" | "completed" | "cancelled" | "failed";

export type ScanJob = {
  id: string;
  email: string;
  status: JobStatus;
  startTime: number;
  lastUpdate: number;
  messagesProcessed: number;
  addressesFound: number;
  nextPageToken?: string;
  lastMessageId?: string;
  error?: string;
};

const MESSAGES_PER_BATCH = 100;
const DELAY_BETWEEN_BATCHES = 500; // ms
const JOB_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Store jobs in Firestore for persistence across serverless requests
async function saveJob(job: ScanJob) {
  const db = getFirestore();
  // Clean undefined values before saving to Firestore
  const cleanJob = { ...job };
  if (cleanJob.nextPageToken === undefined) delete cleanJob.nextPageToken;
  if (cleanJob.lastMessageId === undefined) delete cleanJob.lastMessageId;
  if (cleanJob.error === undefined) delete cleanJob.error;
  await db.collection("_scanJobs").doc(job.id).set(cleanJob);
}

async function loadJob(jobId: string): Promise<ScanJob | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection("_scanJobs").doc(jobId).get();
    if (!doc.exists) return null;

    const job = doc.data() as ScanJob;
    // Check if job has expired
    if (Date.now() - job.lastUpdate > JOB_TTL) {
      // Clean up expired job
      await db.collection("_scanJobs").doc(jobId).delete();
      return null;
    }

    return job;
  } catch (error) {
    console.error("Error loading job:", error);
    return null;
  }
}

async function updateJobInDB(jobId: string, updates: Partial<ScanJob>) {
  try {
    const job = await loadJob(jobId);
    if (!job) return null;

    const updatedJob = { ...job, ...updates, lastUpdate: Date.now() };
    await saveJob(updatedJob);
    return updatedJob;
  } catch (error) {
    console.error("Error updating job:", error);
    return null;
  }
}

export async function createJob(email: string): Promise<string> {
  const jobId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const job: ScanJob = {
    id: jobId,
    email,
    status: "running",
    startTime: Date.now(),
    lastUpdate: Date.now(),
    messagesProcessed: 0,
    addressesFound: 0,
  };

  await saveJob(job);
  return jobId;
}

export async function getJob(jobId: string): Promise<ScanJob | null> {
  return loadJob(jobId);
}

export async function updateJob(jobId: string, updates: Partial<ScanJob>) {
  await updateJobInDB(jobId, updates);
}

export async function cancelJob(jobId: string) {
  const job = await loadJob(jobId);
  if (job && job.status === "running") {
    await updateJobInDB(jobId, { status: "cancelled" });
  }
}

export async function processJob(job: ScanJob): Promise<void> {
  if (job.status !== "running") {
    return;
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      throw new Error("Authentication expired");
    }

    const { gmail } = await getGmailClient(refreshToken);

    // Load existing data to append to
    const existingSnapshot = await loadContactSnapshot(job.email);
    const senders = new Set(existingSnapshot?.senders || []);
    const recipients = new Set(existingSnapshot?.recipients || []);

    // Process next batch of messages
    console.log(
      `Processing batch for job ${job.id}: pageToken=${job.nextPageToken}, processed so far=${job.messagesProcessed}`
    );
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      pageToken: job.nextPageToken,
      maxResults: MESSAGES_PER_BATCH,
      q: "newer_than:365d", // Last year for demo purposes
    });

    const totalMessagesInResponse = listResponse.data.messages?.length || 0;
    const messageIds = listResponse.data.messages?.map((m) => m.id).filter(Boolean) || [];
    console.log(`Fetched ${totalMessagesInResponse} messages from API, ${messageIds.length} valid IDs`);

    if (messageIds.length === 0) {
      // No more messages
      console.log(`No more messages for job ${job.id}, marking as completed`);
      job.status = "completed";
      job.lastUpdate = Date.now();
      return;
    }

    // Get message details in parallel
    const messagePromises = messageIds.map(async (id) => {
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id: id as string,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Bcc"],
        });
        return res.data;
      } catch (error) {
        console.warn(`Failed to fetch message ${id}:`, error);
        return null;
      }
    });

    const messages = (await Promise.all(messagePromises)).filter(Boolean) as gmail_v1.Schema$Message[];

    // Check if job was cancelled during processing
    if (job.status !== "running") {
      return;
    }

    // Extract addresses
    let newAddresses = 0;
    messages.forEach((message) => {
      const parsed = extractAddressesFromMessage(message);
      parsed.senders.forEach((addr) => {
        if (!senders.has(addr)) {
          senders.add(addr);
          newAddresses++;
        }
      });
      parsed.recipients.forEach((addr) => {
        if (!recipients.has(addr)) {
          recipients.add(addr);
          newAddresses++;
        }
      });
    });

    // Update job stats
    job.messagesProcessed += messages.length;
    job.addressesFound += newAddresses;
    job.lastMessageId = messageIds[messageIds.length - 1] as string;
    job.nextPageToken = listResponse.data.nextPageToken || undefined;

    console.log(
      `Job ${job.id} processed ${messages.length} messages, found ${newAddresses} new addresses, nextPageToken=${job.nextPageToken}, total processed=${job.messagesProcessed}`
    );

    // If we got fewer messages than requested, we're done
    if (messages.length < MESSAGES_PER_BATCH || !job.nextPageToken) {
      console.log(
        `Job ${job.id} completed: got ${messages.length} messages (${MESSAGES_PER_BATCH} requested), no nextPageToken`
      );
      job.status = "completed";
    }

    job.lastUpdate = Date.now();

    // Save job progress to Firestore immediately so status polling can see updates
    await saveJob(job);

    // Save updated data incrementally
    const merged = new Set([...senders, ...recipients]);
    const snapshot = {
      senders: Array.from(senders).sort(),
      recipients: Array.from(recipients).sort(),
      merged: Array.from(merged).sort(),
      messageSampleCount: job.messagesProcessed,
      updatedAt: new Date().toISOString(),
    };

    await saveContactSnapshot(job.email, snapshot);

    // Add small delay to avoid hitting rate limits too aggressively
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
  } catch (error) {
    console.error("Job processing error:", error);
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.lastUpdate = Date.now();
    await saveJob(job);
  }
}

export function calculateTimeElapsed(job: ScanJob): number {
  return Math.floor((Date.now() - job.startTime) / 1000);
}

export function estimateTimeRemaining(job: ScanJob): number | null {
  if (job.messagesProcessed === 0) return null;

  const elapsed = calculateTimeElapsed(job);
  if (elapsed < 10) return null; // Need at least 10s to estimate

  // Assume we need to process roughly ~1000 messages for a typical inbox sample
  // This is a rough estimate for UI purposes
  const targetMessages = Math.max(1000, job.messagesProcessed * 1.5);
  const remainingMessages = Math.max(0, targetMessages - job.messagesProcessed);

  if (remainingMessages === 0) return 0;

  const messagesPerSecond = job.messagesProcessed / elapsed;
  return Math.ceil(remainingMessages / messagesPerSecond);
}
