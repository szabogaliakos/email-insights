import { NextRequest, NextResponse } from "next/server";
import { calculateTimeElapsed, estimateTimeRemaining, getJob, processJob } from "@/lib/job-manager";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If job is still running, try to process more
    if (job.status === "running") {
      await processJob(job);
    }

    // Recheck status after potential processing
    const updatedJob = (await getJob(jobId)) || job;
    const elapsed = calculateTimeElapsed(updatedJob);
    const estimatedTimeRemaining = estimateTimeRemaining(updatedJob);

    const response: any = {
      jobId: updatedJob.id,
      status: updatedJob.status,
      messagesProcessed: updatedJob.messagesProcessed,
      addressesFound: updatedJob.addressesFound,
      timeElapsed: elapsed,
      estimatedTimeRemaining,
    };

    if (updatedJob.error) {
      response.error = updatedJob.error;
    }

    if (updatedJob.status === "completed") {
      response.completeMessage = "Scan complete! All messages processed.";
    } else if (updatedJob.status === "cancelled") {
      response.completeMessage = "Scan was cancelled. Data collected so far has been saved.";
    } else if (updatedJob.status === "failed") {
      response.completeMessage = "Scan failed. Try restarting.";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 });
  }
}
