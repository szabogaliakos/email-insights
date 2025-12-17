import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteLabelJob } from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// DELETE /api/gmail/label-jobs/[jobId]/delete - Delete a label job
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const success = await deleteLabelJob(jobId);

    if (!success) {
      return NextResponse.json({ error: "Could not delete job. Job may be running or not found." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error: unknown) {
    console.error("[Delete Label Job Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to delete job",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
