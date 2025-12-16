import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import {
  getLabelJob,
  startLabelJob,
  pauseLabelJob,
  resumeLabelJob,
  cancelLabelJob,
  processLabelJob,
} from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// GET /api/gmail/label-jobs/[jobId] - Get job status
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const job = await getLabelJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("[Get Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to get job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/gmail/label-jobs/[jobId] - Cancel a job
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const success = await cancelLabelJob(jobId);

    if (!success) {
      return NextResponse.json({ error: "Could not cancel job" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error: unknown) {
    console.error("[Cancel Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to cancel job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
