import { NextRequest, NextResponse } from "next/server";
import { IMAPHeaderScanner } from "@/lib/imap-header-scanner";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const job = IMAPHeaderScanner.getIMAPJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "IMAP job not found" }, { status: 404 });
    }

    // If job is complete, we can trigger contact refresh
    if (job.status === "completed") {
      return NextResponse.json({
        ...job,
        completeMessage: job.message,
        messagesProcessed: job.processedMessages,
        addressesFound: job.contactsFound,
        timeElapsed: job.completedAt ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime() : null,
      });
    }

    // If job failed, return error
    if (job.status === "failed") {
      return NextResponse.json(
        {
          ...job,
          status: "failed",
          completeMessage: `IMAP scan failed: ${job.error}`,
        },
        { status: 500 }
      );
    }

    // Still running, return progress
    return NextResponse.json({
      ...job,
      messagesProcessed: job.processedMessages || 0,
      addressesFound: job.contactsFound || 0,
      timeElapsed: new Date().getTime() - new Date(job.startedAt).getTime(),
    });
  } catch (error) {
    console.error("IMAP status error:", error);
    return NextResponse.json({ error: "Failed to get IMAP job status" }, { status: 500 });
  }
}
