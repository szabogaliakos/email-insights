import { NextRequest, NextResponse } from "next/server";
import {
  calculateTimeElapsed,
  estimateTimeRemaining,
  getJob,
  processJob,
  processLabelJob,
  type Job,
  type ScanJob,
  type LabelJob,
} from "@/lib/job-manager";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If job is still running, try to process more
    if (job.status === "running") {
      if ("type" in job && job.type === "label_application") {
        await processLabelJob(job as LabelJob);
      } else {
        await processJob(job as ScanJob);
      }
    }

    // Recheck status after potential processing
    const updatedJob = (await getJob(jobId)) || job;
    const elapsed = calculateTimeElapsed(updatedJob);

    const response: Record<string, unknown> = {
      jobId: updatedJob.id,
      status: updatedJob.status,
      messagesProcessed: updatedJob.messagesProcessed,
      timeElapsed: elapsed,
    };

    // Add job-specific fields
    if ("type" in updatedJob && updatedJob.type === "label_application") {
      // Label job specific fields
      response.messagesMatched = updatedJob.messagesMatched;
      response.labelsApplied = updatedJob.labelsApplied;
      response.filterId = updatedJob.filterId;
    } else {
      // Scan job specific fields
      response.addressesFound = (updatedJob as ScanJob).addressesFound;
      response.estimatedTimeRemaining = estimateTimeRemaining(updatedJob as ScanJob);
    }

    if (updatedJob.error) {
      response.error = updatedJob.error;
    }

    if (updatedJob.status === "completed") {
      if ("type" in updatedJob && updatedJob.type === "label_application") {
        response.completeMessage = "Label application complete! All matching messages have been labeled.";
      } else {
        response.completeMessage = "Scan complete! All messages processed.";
      }
    } else if (updatedJob.status === "cancelled") {
      if ("type" in updatedJob && updatedJob.type === "label_application") {
        response.completeMessage = "Label application was cancelled.";
      } else {
        response.completeMessage = "Scan was cancelled. Data collected so far has been saved.";
      }
    } else if (updatedJob.status === "failed") {
      response.completeMessage = "Job failed. Try restarting.";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 });
  }
}
