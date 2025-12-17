import { getGmailClient } from "@/lib/google";
import { loadContactSnapshot, saveContactSnapshot, getFirestore } from "@/lib/firestore";
import { extractAddressesFromMessage } from "@/lib/gmail";
import type { gmail_v1 } from "googleapis";

export type JobStatus = "pending" | "running" | "paused" | "completed" | "cancelled" | "failed";

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

export type LabelJob = {
  id: string;
  email: string;
  status: JobStatus;
  type: "label_application";
  name: string;
  description: string;
  startTime: number;
  lastUpdate: number;
  filterId: string;
  ruleCriteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    has?: string;
  };
  labelIds: string[];
  messagesProcessed: number;
  messagesMatched: number;
  labelsApplied: number;
  nextPageToken?: string;
  lastMessageId?: string;
  pausedAt?: number;
  resumeCount?: number;
  error?: string;
};

export type Job = ScanJob | LabelJob;

const MESSAGES_PER_BATCH = 100;
const DELAY_BETWEEN_BATCHES = 500; // ms
const JOB_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Store jobs in Firestore for persistence across serverless requests
async function saveScanJob(job: ScanJob) {
  const db = getFirestore();
  // Clean undefined values before saving to Firestore
  const cleanJob = { ...job };
  if (cleanJob.nextPageToken === undefined) delete cleanJob.nextPageToken;
  if (cleanJob.lastMessageId === undefined) delete cleanJob.lastMessageId;
  if (cleanJob.error === undefined) delete cleanJob.error;
  await db.collection("_scanJobs").doc(job.id).set(cleanJob);
}

async function loadScanJob(jobId: string): Promise<ScanJob | null> {
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
    console.error("Error loading scan job:", error);
    return null;
  }
}

async function updateScanJobInDB(jobId: string, updates: Partial<ScanJob>) {
  try {
    const job = await loadScanJob(jobId);
    if (!job) return null;

    const updatedJob = { ...job, ...updates, lastUpdate: Date.now() };
    await saveScanJob(updatedJob);
    return updatedJob;
  } catch (error) {
    console.error("Error updating scan job:", error);
    return null;
  }
}

// Label job functions
async function saveLabelJob(job: LabelJob) {
  const db = getFirestore();
  // Clean undefined values before saving to Firestore
  const cleanJob = { ...job };
  if (cleanJob.nextPageToken === undefined) delete cleanJob.nextPageToken;
  if (cleanJob.lastMessageId === undefined) delete cleanJob.lastMessageId;
  if (cleanJob.pausedAt === undefined) delete cleanJob.pausedAt;
  if (cleanJob.resumeCount === undefined) delete cleanJob.resumeCount;
  if (cleanJob.error === undefined) delete cleanJob.error;
  await db.collection("_labelJobs").doc(job.id).set(cleanJob);
}

async function loadLabelJob(jobId: string): Promise<LabelJob | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection("_labelJobs").doc(jobId).get();
    if (!doc.exists) return null;

    const job = doc.data() as LabelJob;
    // Check if job has expired
    if (Date.now() - job.lastUpdate > JOB_TTL) {
      // Clean up expired job
      await db.collection("_labelJobs").doc(jobId).delete();
      return null;
    }

    return job;
  } catch (error) {
    console.error("Error loading label job:", error);
    return null;
  }
}

async function updateLabelJobInDB(jobId: string, updates: Partial<LabelJob>) {
  try {
    const job = await loadLabelJob(jobId);
    if (!job) return null;

    const updatedJob = { ...job, ...updates, lastUpdate: Date.now() };
    await saveLabelJob(updatedJob);
    return updatedJob;
  } catch (error) {
    console.error("Error updating label job:", error);
    return null;
  }
}

export async function loadJob(jobId: string): Promise<Job | null> {
  // Try scan job first
  const scanJob = await loadScanJob(jobId);
  if (scanJob) return scanJob;

  // Try label job
  const labelJob = await loadLabelJob(jobId);
  return labelJob;
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

  await saveScanJob(job);
  return jobId;
}

export async function getJob(jobId: string): Promise<Job | null> {
  return loadJob(jobId);
}

export async function updateJob(jobId: string, updates: Partial<ScanJob>) {
  await updateScanJobInDB(jobId, updates);
}

export async function cancelJob(jobId: string) {
  const job = await loadScanJob(jobId);
  if (job && job.status === "running") {
    await updateScanJobInDB(jobId, { status: "cancelled" });
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
    await saveScanJob(job);

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
    await saveScanJob(job);
  }
}

// Label Job Functions
export async function createLabelJob(
  email: string,
  filterId: string,
  ruleCriteria: LabelJob["ruleCriteria"],
  labelIds: string[]
): Promise<string> {
  const jobId = `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate a meaningful name and description
  const criteriaParts: string[] = [];
  if (ruleCriteria.from) criteriaParts.push(`from:${ruleCriteria.from}`);
  if (ruleCriteria.to) criteriaParts.push(`to:${ruleCriteria.to}`);
  if (ruleCriteria.subject) criteriaParts.push(`subject:${ruleCriteria.subject}`);
  if (ruleCriteria.query) criteriaParts.push(ruleCriteria.query);
  if (ruleCriteria.has) criteriaParts.push(`has:${ruleCriteria.has}`);

  const criteriaSummary =
    criteriaParts.length > 0
      ? criteriaParts.slice(0, 2).join(", ") + (criteriaParts.length > 2 ? "..." : "")
      : "any emails";

  // Generate name and description
  const name = `Apply labels to ${criteriaSummary}`;
  const description = `Searching your Gmail for messages matching: ${criteriaSummary}. Will apply ${
    labelIds.length
  } label${labelIds.length > 1 ? "s" : ""} to all matching messages.`;

  const job: LabelJob = {
    id: jobId,
    email,
    status: "pending",
    type: "label_application",
    name,
    description,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    filterId,
    ruleCriteria,
    labelIds,
    messagesProcessed: 0,
    messagesMatched: 0,
    labelsApplied: 0,
  };

  await saveLabelJob(job);
  return jobId;
}

export async function getLabelJob(jobId: string): Promise<LabelJob | null> {
  return loadLabelJob(jobId);
}

export async function startLabelJob(jobId: string): Promise<boolean> {
  const job = await loadLabelJob(jobId);
  if (!job || job.status !== "pending") return false;

  await updateLabelJobInDB(jobId, {
    status: "running",
    resumeCount: (job.resumeCount || 0) + 1,
  });
  return true;
}

export async function pauseLabelJob(jobId: string): Promise<boolean> {
  const job = await loadLabelJob(jobId);
  if (!job || job.status !== "running") return false;

  await updateLabelJobInDB(jobId, {
    status: "paused",
    pausedAt: Date.now(),
  });
  return true;
}

export async function resumeLabelJob(jobId: string): Promise<boolean> {
  const job = await loadLabelJob(jobId);
  if (!job || job.status !== "paused") return false;

  await updateLabelJobInDB(jobId, {
    status: "running",
    resumeCount: (job.resumeCount || 0) + 1,
  });
  return true;
}

export async function cancelLabelJob(jobId: string): Promise<boolean> {
  const job = await loadLabelJob(jobId);
  if (!job || !["pending", "running", "paused"].includes(job.status)) return false;

  await updateLabelJobInDB(jobId, { status: "cancelled" });
  return true;
}

export async function deleteLabelJob(jobId: string): Promise<boolean> {
  const job = await loadLabelJob(jobId);
  if (!job) return false;

  // Only allow deletion of jobs that are not running
  if (job.status === "running") return false;

  try {
    const db = getFirestore();
    await db.collection("_labelJobs").doc(jobId).delete();
    return true;
  } catch (error) {
    console.error("Error deleting label job:", error);
    return false;
  }
}

export async function processLabelJob(job: LabelJob): Promise<void> {
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

    // Build search query from filter criteria
    const queryParts: string[] = [];
    if (job.ruleCriteria.from) queryParts.push(`from:${job.ruleCriteria.from}`);
    if (job.ruleCriteria.to) queryParts.push(`to:${job.ruleCriteria.to}`);
    if (job.ruleCriteria.subject) queryParts.push(`subject:${job.ruleCriteria.subject}`);
    if (job.ruleCriteria.query) queryParts.push(job.ruleCriteria.query);
    if (job.ruleCriteria.has) queryParts.push(`has:${job.ruleCriteria.has}`);

    const searchQuery = queryParts.join(" ");

    console.log(
      `Processing label job ${job.id}: query="${searchQuery}", pageToken=${job.nextPageToken}, processed so far=${job.messagesProcessed}`
    );

    // Search for messages matching the criteria
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      pageToken: job.nextPageToken,
      maxResults: MESSAGES_PER_BATCH,
    });

    const messageIds = listResponse.data.messages?.map((m) => m.id).filter(Boolean) || [];

    if (messageIds.length === 0) {
      // No more messages
      console.log(`No more messages for label job ${job.id}, marking as completed`);
      await updateLabelJobInDB(job.id, { status: "completed" });
      return;
    }

    // Process messages in batches and apply labels
    let labelsAppliedInBatch = 0;
    let messagesMatchedInBatch = 0;

    // Process messages in smaller chunks to avoid rate limits
    for (let i = 0; i < messageIds.length; i += 10) {
      const batch = messageIds.slice(i, i + 10);

      // Check if job was paused/cancelled during processing
      const currentJob = await loadLabelJob(job.id);
      if (!currentJob || currentJob.status !== "running") {
        console.log(`Label job ${job.id} was ${currentJob?.status}, stopping processing`);
        return;
      }

      // Apply labels to this batch
      const modifyPromises = batch.map(async (messageId) => {
        try {
          await gmail.users.messages.modify({
            userId: "me",
            id: messageId as string,
            requestBody: {
              addLabelIds: job.labelIds,
            },
          });
          return true;
        } catch (error) {
          console.warn(`Failed to apply labels to message ${messageId}:`, error);
          return false;
        }
      });

      const results = await Promise.all(modifyPromises);
      const successful = results.filter(Boolean).length;

      labelsAppliedInBatch += successful;
      messagesMatchedInBatch += batch.length;

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update job progress
    const updatedJob = await updateLabelJobInDB(job.id, {
      messagesProcessed: job.messagesProcessed + messageIds.length,
      messagesMatched: job.messagesMatched + messagesMatchedInBatch,
      labelsApplied: job.labelsApplied + labelsAppliedInBatch,
      lastMessageId: messageIds.length > 0 ? messageIds[messageIds.length - 1]! : undefined,
      nextPageToken: listResponse.data.nextPageToken ?? undefined,
    });

    console.log(
      `Label job ${job.id} processed ${messageIds.length} messages, applied ${labelsAppliedInBatch} labels, nextPageToken=${updatedJob?.nextPageToken}, total processed=${updatedJob?.messagesProcessed}`
    );

    // If we got fewer messages than requested, we're done
    if (messageIds.length < MESSAGES_PER_BATCH || !updatedJob?.nextPageToken) {
      console.log(
        `Label job ${job.id} completed: got ${messageIds.length} messages (${MESSAGES_PER_BATCH} requested), no nextPageToken`
      );
      await updateLabelJobInDB(job.id, { status: "completed" });
    }
  } catch (error) {
    console.error("Label job processing error:", error);
    await updateLabelJobInDB(job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getAllLabelJobs(email: string): Promise<LabelJob[]> {
  const db = getFirestore();

  try {
    // Get only label jobs
    const labelJobsSnapshot = await db.collection("_labelJobs").where("email", "==", email).limit(50).get();

    const labelJobs = labelJobsSnapshot.docs.map((doc) => doc.data() as LabelJob);

    // Sort by lastUpdate in memory (most recent first)
    const sortedJobs = labelJobs.sort((a, b) => b.lastUpdate - a.lastUpdate);

    return sortedJobs;
  } catch (error) {
    console.error("Error loading label jobs:", error);
    return [];
  }
}

export function calculateTimeElapsed(job: ScanJob | LabelJob): number {
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
