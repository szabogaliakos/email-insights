import { NextRequest, NextResponse } from "next/server";
import { LabelJobTaskPayload } from "@/lib/cloud-tasks";
import { processLabelJob } from "@/lib/job-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max execution time

/**
 * Worker endpoint for processing label jobs via Google Cloud Tasks
 * POST /api/workers/label-jobs/[jobId]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const startTime = Date.now();
  let jobId = "unknown";

  try {
    const paramsData = await params;
    jobId = paramsData.jobId;

    // Parse task payload from Cloud Tasks
    let payload: LabelJobTaskPayload;
    try {
      const body = await request.json();
      payload = body as LabelJobTaskPayload;
    } catch (error) {
      console.error(`[Worker ${jobId}] Failed to parse task payload:`, error);
      return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
    }

    // Validate payload
    if (!payload.jobId || !payload.userEmail) {
      console.error(`[Worker ${jobId}] Invalid payload:`, payload);
      return NextResponse.json({ error: "Missing required payload fields" }, { status: 400 });
    }

    console.log(`[Worker ${jobId}] Starting label job processing`, {
      userEmail: payload.userEmail,
      batchSize: payload.batchSize,
      pageToken: payload.pageToken,
      retryCount: payload.retryCount,
      timestamp: payload.timestamp,
    });

    // Get job details
    const { getLabelJob } = await import("@/lib/job-manager");
    const job = await getLabelJob(jobId);

    if (!job) {
      console.error(`[Worker ${jobId}] Job not found`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "running") {
      console.log(`[Worker ${jobId}] Job status is ${job.status}, skipping processing`);
      return NextResponse.json({ message: "Job not in running state", status: job.status }, { status: 200 });
    }

    // Process the job batch
    console.log(`[Worker ${jobId}] Processing batch...`);
    await processLabelJob(job);

    const processingTime = Date.now() - startTime;
    console.log(`[Worker ${jobId}] Completed batch processing in ${processingTime}ms`);

    // Check if more work remains and create next task if needed
    const updatedJob = await getLabelJob(jobId);
    if (updatedJob && updatedJob.status === "running" && updatedJob.nextPageToken) {
      console.log(`[Worker ${jobId}] More work remains, creating next task`);

      const { createLabelJobTask } = await import("@/lib/cloud-tasks");
      try {
        await createLabelJobTask(jobId, payload.userEmail, undefined, {
          batchSize: payload.batchSize,
          pageToken: updatedJob.nextPageToken,
          retryCount: payload.retryCount,
          delaySeconds: 5, // Small delay between batches
        });
        console.log(`[Worker ${jobId}] Created next task successfully`);
      } catch (taskError) {
        console.error(`[Worker ${jobId}] Failed to create next task:`, taskError);
        // Continue - the job will be retried by Cloud Tasks
      }
    } else {
      console.log(`[Worker ${jobId}] Job completed or no more work`);
    }

    return NextResponse.json({
      success: true,
      message: "Label job batch processed successfully",
      processingTime,
      jobId,
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[Worker ${jobId || "unknown"}] Processing failed after ${processingTime}ms:`, error);

    // Don't fail the Cloud Tasks request - let Cloud Tasks handle retries
    // Instead, return success but log the error for monitoring
    return NextResponse.json(
      {
        success: false,
        error: "Processing failed",
        message: error.message,
        processingTime,
      },
      { status: 200 } // Return 200 to avoid Cloud Tasks retries for logic errors
    );
  }
}
