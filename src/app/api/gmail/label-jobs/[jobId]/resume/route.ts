import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { getLabelJob, resumeLabelJob, processLabelJob } from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// PATCH /api/gmail/label-jobs/[jobId]/resume - Resume a job
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const success = await resumeLabelJob(jobId);

    if (!success) {
      return NextResponse.json({ error: "Could not resume job" }, { status: 400 });
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
      message: "Job resumed successfully",
    });
  } catch (error: unknown) {
    console.error("[Resume Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to resume job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
