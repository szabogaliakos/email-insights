import { NextRequest, NextResponse } from "next/server";
import { cancelJob, getJob } from "@/lib/job-manager";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

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
