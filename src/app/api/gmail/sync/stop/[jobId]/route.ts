import { NextRequest, NextResponse } from "next/server";
import { cancelJob, getJob } from "@/lib/job-manager";
import { IMAPHeaderScanner, GmailAPIScanner } from "@/lib/imap-header-scanner";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    // Handle IMAP jobs (stored in memory)
    if (jobId.startsWith("imap_")) {
      const imapJob = IMAPHeaderScanner.getIMAPJob(jobId);
      if (!imapJob) {
        return NextResponse.json({ error: "IMAP job not found" }, { status: 404 });
      }

      IMAPHeaderScanner.updateIMAPJob(jobId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
        message: "Scan cancelled by user",
      });

      return NextResponse.json({
        jobId,
        status: "cancelled",
        message: "Scan cancelled. Data collected so far has been saved.",
      });
    }

    // Handle Gmail API jobs (stored in memory)
    if (jobId.startsWith("gmailapi_")) {
      const gmailJob = GmailAPIScanner.getGmailApiJob(jobId);
      if (!gmailJob) {
        return NextResponse.json({ error: "Gmail API job not found" }, { status: 404 });
      }

      GmailAPIScanner.updateGmailApiJob(jobId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
        message: "Scan cancelled by user",
      });

      return NextResponse.json({
        jobId,
        status: "cancelled",
        message: "Scan cancelled. Data collected so far has been saved.",
      });
    }

    // Handle API jobs (stored in Firestore)
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await cancelJob(jobId);

    return NextResponse.json({
      jobId,
      status: "cancelled",
      message: "Scan cancelled. Data collected so far has been saved.",
    });
  } catch (error) {
    console.error("Stop scan error:", error);
    return NextResponse.json({ error: "Failed to stop scan" }, { status: 500 });
  }
}
