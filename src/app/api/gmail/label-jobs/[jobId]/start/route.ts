import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { getLabelJob, startLabelJob, processLabelJob } from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// POST /api/gmail/label-jobs/[jobId]/start - Start a job
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const success = await startLabelJob(jobId);

    if (!success) {
      return NextResponse.json({ error: "Could not start job" }, { status: 400 });
    }

    // Start processing in background
    const jobForProcessing = await getLabelJob(jobId);
    if (jobForProcessing) {
      processLabelJob(jobForProcessing).catch((error) => {
        console.error(`Background processing failed for job ${jobId}:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Job started successfully",
    });
  } catch (error: unknown) {
    console.error("[Start Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to start job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
