/**
 * Google Cloud Tasks utilities for asynchronous job processing
 */

// Check if we're in a server environment
const isServer = typeof window === "undefined";

// Lazy load Cloud Tasks client - only attempt in server environment
let cloudTasksClient: any = null;
let cloudTasksAvailable = false;

function getCloudTasksClient() {
  // Only attempt to load Cloud Tasks on server-side
  if (!isServer) {
    throw new Error("Cloud Tasks is only available on the server-side");
  }

  if (cloudTasksClient === null) {
    // null means not yet attempted
    try {
      // Use require for Google Cloud Tasks since dynamic import causes issues
      const { CloudTasksClient } = require("@google-cloud/tasks");
      cloudTasksClient = new CloudTasksClient();
      cloudTasksAvailable = true;
      console.log("✅ Cloud Tasks client initialized successfully");
    } catch (error: any) {
      console.warn("⚠️ Cloud Tasks not available:", error.message);
      cloudTasksClient = false; // false means attempted but failed
      cloudTasksAvailable = false;
    }
  }

  if (cloudTasksClient === false) {
    throw new Error("Google Cloud Tasks is not available. This is optional - jobs will run synchronously instead.");
  }

  return cloudTasksClient;
}

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  projectId: string;
  location: string;
  queueName: string;
  maxRetries?: number;
  maxBackoff?: string; // ISO 8601 duration
  minBackoff?: string; // ISO 8601 duration
}

/**
 * Task payload for label job processing
 */
export interface LabelJobTaskPayload {
  jobId: string;
  userEmail: string;
  batchSize: number;
  pageToken?: string;
  retryCount: number;
  timestamp: string;
}

/**
 * Get default task queue configuration
 */
export function getDefaultQueueConfig(): TaskQueueConfig {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
  const location = process.env.CLOUD_TASKS_LOCATION || "us-central1";
  const queueName = process.env.CLOUD_TASKS_QUEUE_NAME || "label-jobs-queue";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable is required");
  }

  return {
    projectId,
    location,
    queueName,
    maxRetries: 3,
    maxBackoff: "3600s", // 1 hour
    minBackoff: "60s", // 1 minute
  };
}

/**
 * Get the full queue path
 */
export function getQueuePath(config: TaskQueueConfig): string {
  const client = getCloudTasksClient();
  return client.queuePath(config.projectId, config.location, config.queueName);
}

/**
 * Create or update a task queue with retry configuration
 */
export async function createOrUpdateQueue(config: TaskQueueConfig = getDefaultQueueConfig()): Promise<void> {
  const client = getCloudTasksClient();
  const queuePath = getQueuePath(config);

  const queue = {
    name: queuePath,
    retryConfig: {
      maxAttempts: config.maxRetries || 3,
      maxRetryDuration: { seconds: 3600 }, // 1 hour
      minBackoff: { seconds: 60 }, // 1 minute
    },
  };

  try {
    await client.createQueue({
      parent: client.locationPath(config.projectId, config.location),
      queue,
    });
    console.log(`✅ Created Cloud Tasks queue: ${config.queueName}`);
  } catch (error: any) {
    if (error.code === 6) {
      // ALREADY_EXISTS
      // Update existing queue
      try {
        await client.updateQueue({
          queue: {
            ...queue,
            retryConfig: {
              ...queue.retryConfig,
            },
          },
          updateMask: {
            paths: ["retry_config"],
          },
        });
        console.log(`✅ Updated Cloud Tasks queue: ${config.queueName}`);
      } catch (updateError) {
        console.warn(`⚠️ Failed to update queue ${config.queueName}:`, updateError);
      }
    } else {
      console.error(`❌ Failed to create queue ${config.queueName}:`, error);
      throw error;
    }
  }
}

/**
 * Create a task for label job processing
 */
export async function createLabelJobTask(
  jobId: string,
  userEmail: string,
  config: TaskQueueConfig = getDefaultQueueConfig(),
  options: {
    batchSize?: number;
    pageToken?: string;
    retryCount?: number;
    delaySeconds?: number;
  } = {}
): Promise<string> {
  const client = getCloudTasksClient();
  const queuePath = getQueuePath(config);

  // Create task payload
  const payload: LabelJobTaskPayload = {
    jobId,
    userEmail,
    batchSize: options.batchSize || 50,
    pageToken: options.pageToken,
    retryCount: options.retryCount || 0,
    timestamp: new Date().toISOString(),
  };

  // Create task
  const task: any = {
    httpRequest: {
      httpMethod: "POST" as const,
      url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/workers/label-jobs/${jobId}`,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
  };

  // Add delay if specified
  if (options.delaySeconds && options.delaySeconds > 0) {
    task.scheduleTime = {
      seconds: Math.floor(Date.now() / 1000) + options.delaySeconds,
    };
  }

  try {
    const [response] = await client.createTask({
      parent: queuePath,
      task,
    });

    console.log(`✅ Created Cloud Tasks task for job ${jobId}: ${response.name}`);
    return response.name || "";
  } catch (error) {
    console.error(`❌ Failed to create task for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Delete a task (for cancellation)
 */
export async function deleteTask(taskName: string): Promise<void> {
  const client = getCloudTasksClient();
  try {
    await client.deleteTask({ name: taskName });
    console.log(`✅ Deleted Cloud Tasks task: ${taskName}`);
  } catch (error: any) {
    if (error.code === 5) {
      // NOT_FOUND
      console.log(`ℹ️ Task already deleted or not found: ${taskName}`);
    } else {
      console.error(`❌ Failed to delete task ${taskName}:`, error);
      throw error;
    }
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(config: TaskQueueConfig = getDefaultQueueConfig()) {
  const client = getCloudTasksClient();
  try {
    const queuePath = getQueuePath(config);
    const [queue] = await client.getQueue({ name: queuePath });
    return queue;
  } catch (error) {
    console.error(`❌ Failed to get queue stats:`, error);
    return null;
  }
}

/**
 * Validate Cloud Tasks authentication
 */
export async function validateCloudTasksSetup(): Promise<boolean> {
  try {
    const config = getDefaultQueueConfig();
    await getQueueStats(config);
    return true;
  } catch (error) {
    console.error("❌ Cloud Tasks setup validation failed:", error);
    return false;
  }
}
