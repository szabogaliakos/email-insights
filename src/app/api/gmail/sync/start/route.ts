import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { IMAPHeaderScanner } from "@/lib/imap-header-scanner";
import { saveContactSnapshot } from "@/lib/firestore";
import { createJob, processJob, getJob } from "@/lib/job-manager";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    // Check if IMAP scanning is requested
    const { method = "api" } = await request.json();

    if (method === "imap") {
      // Use fast IMAP scanning with job-based progress tracking
      console.log("[SCAN] Using IMAP method for contact scanning");

      const { auth: oauth2Client, email } = await getGmailClient(refreshToken);

      try {
        // Create IMAP job with progress tracking
        const imapJobId = `imap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Start IMAP scanning in background (don't await)
        IMAPHeaderScanner.scanHeadersAsync(refreshToken, email, imapJobId).then(
          async (result) => {
            console.log(`[IMAP] Success: Found ${result.contacts} contacts from ${result.scanned} messages`);

            // Save the result
            const snapshot = {
              senders: result.senders,
              recipients: result.recipients,
              merged: result.merged,
              messageSampleCount: result.scanned,
              updatedAt: new Date().toISOString(),
            };
            await saveContactSnapshot(email, snapshot);

            // Update job as completed
            IMAPHeaderScanner.updateIMAPJob(imapJobId, {
              status: "completed",
              scanned: result.scanned,
              contacts: result.contacts,
              message: result.message,
              senderCount: result.senders.length,
              recipientCount: result.recipients.length,
              completedAt: new Date().toISOString(),
            });
          },
          (error) => {
            console.error("[IMAP] Scan failed:", error);
            IMAPHeaderScanner.updateIMAPJob(imapJobId, {
              status: "failed",
              error: error.message,
              completedAt: new Date().toISOString(),
            });
          }
        );

        return NextResponse.json({
          success: true,
          method: "imap",
          jobId: imapJobId,
          status: "started",
          message: "IMAP scan started with progress tracking",
        });
      } catch (imapError: any) {
        console.error("[IMAP] Failed to start IMAP scan:", imapError);

        // Check if it's a common authentication error
        const errorMessage = imapError.message || "Unknown IMAP error";
        let userFriendlyMessage = "IMAP setup failed. IMAP requires Gmail app password configured.";

        if (errorMessage.includes("Command failed") || errorMessage.includes("AUTHENTICATIONFAILED")) {
          userFriendlyMessage = "IMAP authentication failed. Please check your Gmail app password in Settings.";
        }

        return NextResponse.json(
          {
            error: userFriendlyMessage,
            details: errorMessage,
            fallback: "api",
            suggestion: "Please configure IMAP settings in Settings page first.",
          },
          { status: 500 }
        );
      }
    }

    // Default: Use existing API-based job processing
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
      method: "api",
    });
  } catch (error) {
    console.error("Start scan error:", error);
    return NextResponse.json({ error: "Failed to start scan" }, { status: 500 });
  }
}
