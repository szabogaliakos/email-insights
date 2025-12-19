import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import {
  createLabelJob,
  getAllLabelJobs,
  startLabelJob,
  pauseLabelJob,
  resumeLabelJob,
  cancelLabelJob,
  deleteLabelJob,
} from "@/lib/job-manager";

export const dynamic = "force-dynamic";

// GET /api/gmail/label-jobs - List all jobs
export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const jobs = await getAllLabelJobs(email);

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("[Label Jobs API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to load jobs",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST /api/gmail/label-jobs - Create a new label job
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const body = await request.json();
    const { filterId, ruleCriteria, labelIds } = body;

    if (!filterId || !ruleCriteria || !labelIds || !Array.isArray(labelIds)) {
      return NextResponse.json({ error: "Missing required fields: filterId, ruleCriteria, labelIds" }, { status: 400 });
    }

    const jobId = await createLabelJob(email, filterId, ruleCriteria, labelIds);

    return NextResponse.json({
      success: true,
      jobId,
      message: "Label job created successfully",
    });
  } catch (error: any) {
    console.error("[Create Label Job Error]", error);
    return NextResponse.json(
      {
        error: "Failed to create label job",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/gmail/label-jobs - Delete job by filterId
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const body = await request.json();
    const { filterId } = body;

    if (!filterId) {
      return NextResponse.json({ error: "Missing required field: filterId" }, { status: 400 });
    }

    // Find and delete jobs with this filterId
    const db = await import("@/lib/firestore").then((m) => m.getFirestore());
    const jobsSnapshot = await db
      .collection("_labelJobs")
      .where("email", "==", email)
      .where("filterId", "==", filterId)
      .get();

    if (jobsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No label jobs found for this filter",
      });
    }

    const deletePromises = jobsSnapshot.docs.map(async (doc) => {
      const jobId = doc.id;
      await db.collection("_labelJobs").doc(jobId).delete();
    });

    await Promise.all(deletePromises);

    return NextResponse.json({
      success: true,
      message: `Deleted ${jobsSnapshot.docs.length} label job(s)`,
    });
  } catch (error: any) {
    console.error("[Delete Label Job Error]", error);
    return NextResponse.json(
      {
        error: "Failed to delete label job",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
