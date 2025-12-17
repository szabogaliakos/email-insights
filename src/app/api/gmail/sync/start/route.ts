import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/google";
import { IMAPHeaderScanner } from "@/lib/scanners/imap-header-scanner";
import { GmailAPIScanner } from "@/lib/scanners/gmail-api-scanner";
import { saveContactSnapshot, loadContactSnapshot, saveIMAPProgress, loadIMAPProgress } from "@/lib/firestore";
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
      console.log("[SCAN] Starting IMAP method for contact scanning");

      const { auth: oauth2Client, email } = await getGmailClient(refreshToken);

      try {
        // Create IMAP job with progress tracking
        const imapJobId = `imap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Start IMAP scanning in background (don't await)
        IMAPHeaderScanner.scanHeadersAsync(refreshToken, email, imapJobId).then(
          async (result) => {
            console.log(`[IMAP] Chunk completed: Found ${result.contacts} contacts from ${result.scanned} messages`);

            // Load existing contact data to merge with
            const existingContacts = await loadContactSnapshot(email);
            const existingProgress = await loadIMAPProgress(email);

            // Merge new chunk with existing contacts
            const allSenders = [...new Set([...(existingContacts?.senders || []), ...result.senders])];

            const allRecipients = [...new Set([...(existingContacts?.recipients || []), ...result.recipients])];

            const allMerged = [...new Set([...allSenders, ...allRecipients])];
            const totalMessagesScanned = (existingContacts?.messageSampleCount || 0) + result.scanned;

            // Save merged contacts
            const snapshot = {
              senders: allSenders,
              recipients: allRecipients,
              merged: allMerged,
              messageSampleCount: totalMessagesScanned,
              updatedAt: new Date().toISOString(),
            };
            await saveContactSnapshot(email, snapshot);

            // Save scan progress for resume capability
            const progressUpdate = {
              mailbox: existingProgress?.mailbox || "[Gmail]/All Mail", // Default mailbox
              lastMessageScanned: result.lastMessageScanned as number, // IMAP uses numbers
              totalMessages: existingProgress?.totalMessages || 0, // This would be the full mailbox size
              contactsFound: allMerged.length,
              chunksCompleted: (existingProgress?.chunksCompleted || 0) + (result.scanned > 0 ? 1 : 0),
              isComplete: result.scanned === 0, // If no new messages were scanned, we're done
            };
            await saveIMAPProgress(email, progressUpdate);

            // Update job as completed
            IMAPHeaderScanner.updateIMAPJob(imapJobId, {
              status: "completed",
              scanned: result.scanned,
              totalScanned: totalMessagesScanned,
              contacts: result.contacts,
              totalContacts: allMerged.length,
              message: result.message,
              lastMessageScanned: result.lastMessageScanned,
              completedAt: new Date().toISOString(),
            });

            console.log(
              `[IMAP] Progress saved: ${progressUpdate.lastMessageScanned} messages scanned total, ${allMerged.length} contacts`
            );
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

    // Default: Use new Gmail API scanner with job-based progress tracking
    console.log("[SCAN] Using Gmail API method with job-based progress tracking");

    const { auth: oauth2Client, gmail, email } = await getGmailClient(refreshToken);

    try {
      // Create Gmail API job with progress tracking
      const apiJobId = `gmailapi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Start Gmail API scanning in background (don't await)
      GmailAPIScanner.scanMessagesAPI(refreshToken, email, apiJobId).then(
        async (result) => {
          console.log(`[Gmail API] Scan completed: Found ${result.contacts} contacts from ${result.scanned} messages`);

          // Load existing contact data to merge with
          const existingContacts = await loadContactSnapshot(email);

          // Merge new scan with existing contacts
          const allSenders = [...new Set([...(existingContacts?.senders || []), ...result.senders])];
          const allRecipients = [...new Set([...(existingContacts?.recipients || []), ...result.recipients])];
          const allMerged = [...new Set([...allSenders, ...allRecipients])];
          const totalMessagesScanned = (existingContacts?.messageSampleCount || 0) + result.scanned;

          // Save merged contacts
          const snapshot = {
            senders: allSenders,
            recipients: allRecipients,
            merged: allMerged,
            messageSampleCount: totalMessagesScanned,
            updatedAt: new Date().toISOString(),
          };
          await saveContactSnapshot(email, snapshot);

          // Update job as completed
          GmailAPIScanner.updateGmailApiJob(apiJobId, {
            status: "completed",
            scanned: result.scanned,
            totalScanned: totalMessagesScanned,
            contacts: result.contacts,
            totalContacts: allMerged.length,
            message: result.message,
            completedAt: new Date().toISOString(),
          });

          console.log(
            `[Gmail API] Contacts saved: ${allMerged.length} total unique contacts from ${totalMessagesScanned} messages`
          );
        },
        (error) => {
          console.error("[Gmail API] Scan failed:", error);
          GmailAPIScanner.updateGmailApiJob(apiJobId, {
            status: "failed",
            error: error.message,
            completedAt: new Date().toISOString(),
          });
        }
      );

      return NextResponse.json({
        success: true,
        method: "api",
        jobId: apiJobId,
        status: "started",
        message: "Gmail API scan started with progress tracking",
      });
    } catch (apiError: any) {
      console.error("[Gmail API] Failed to start Gmail API scan:", apiError);

      const errorMessage = apiError.message || "Unknown Gmail API error";
      let userFriendlyMessage = "Gmail API scanning failed.";

      if (errorMessage.includes("quota") || errorMessage.includes("rate")) {
        userFriendlyMessage = "Gmail API rate limit exceeded. Please try again later or use IMAP scanning.";
      } else if (errorMessage.includes("auth") || errorMessage.includes("token")) {
        userFriendlyMessage = "Gmail authentication expired. Please reconnect your Gmail account.";
      }

      return NextResponse.json(
        {
          error: userFriendlyMessage,
          details: errorMessage,
          suggestion: "You can try IMAP scanning with an app password for faster results.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Start scan error:", error);
    return NextResponse.json({ error: "Failed to start scan" }, { status: 500 });
  }
}
