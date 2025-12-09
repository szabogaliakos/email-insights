import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { createJob, processJob, getJob } from "@/lib/job-manager";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { gmail, email } = await getGmailClient(refreshToken);

    // Create new job
    const jobId = await createJob(email);

    // Process first batch immediately
    const job = await getJob(jobId);
    if (job) {
      await processJob(job);
    }

    return NextResponse.json({
      jobId,
      status: "started",
      email,
    });
  } catch (error) {
    console.error("Start scan error:", error);
    return NextResponse.json({ error: "Failed to start scan" }, { status: 500 });
  }
}
