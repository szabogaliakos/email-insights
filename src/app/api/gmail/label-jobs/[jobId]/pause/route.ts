import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { pauseLabelJob } from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// PUT /api/gmail/label-jobs/[jobId]/pause - Pause a job
export async function PUT(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const success = await pauseLabelJob(jobId);

    if (!success) {
      return NextResponse.json({ error: "Could not pause job" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Job paused successfully",
    });
  } catch (error: unknown) {
    console.error("[Pause Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to pause job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
