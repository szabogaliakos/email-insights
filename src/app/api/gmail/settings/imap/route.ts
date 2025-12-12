import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";
import { saveIMAPSettings, loadIMAPSettings, deleteIMAPSettings, GmailIMAPSettings } from "@/lib/firestore";
import { PasswordEncryption } from "@/lib/crypto";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { email } = await getGmailClient(refreshToken);
    const settings = await loadIMAPSettings(email);

    // Don't return the encrypted password
    if (settings) {
      const { appPassword, ...publicSettings } = settings;
      return NextResponse.json({
        ...publicSettings,
        hasPassword: !!appPassword,
      });
    }

    return NextResponse.json({ enabled: false, setupCompleted: false });
  } catch (error: any) {
    console.error("Load IMAP settings error:", error);
    return NextResponse.json({ error: "Failed to load IMAP settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { email } = await getGmailClient(refreshToken);
    const body = await request.json();
    const { appPassword, enabled = true } = body;

    // Validate app password format (Gmail app passwords are 16 characters)
    if (!appPassword || appPassword.length !== 16) {
      return NextResponse.json(
        {
          error: "Invalid app password format. Gmail app passwords are 16 characters long.",
        },
        { status: 400 }
      );
    }

    // Test the IMAP connection with the provided password
    try {
      console.log(`[IMAP] Testing connection for user: ${email}`);

      // Import here to avoid circular dependencies
      const { ImapFlow } = await import("imapflow");

      const testImap = new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: {
          user: email,
          pass: appPassword,
        },
        logger: false,
      });

      // Test the connection
      await testImap.connect();
      await testImap.logout();

      console.log(`[IMAP] Connection test successful for: ${email}`);
    } catch (testError: any) {
      console.error("[IMAP] Connection test failed:", testError);
      return NextResponse.json(
        {
          error:
            "IMAP connection test failed. Please check your Gmail app password and ensure IMAP is enabled in Gmail settings.",
          details: testError.message,
        },
        { status: 400 }
      );
    }

    // Encrypt and save the password
    const encryptedPassword = PasswordEncryption.encrypt(appPassword, email);

    const settings: Omit<GmailIMAPSettings, "createdAt" | "updatedAt"> = {
      enabled,
      appPassword: encryptedPassword,
      imapEnabledInGmail: true, // We just verified it works
      setupCompleted: true,
    };

    await saveIMAPSettings(email, settings);

    return NextResponse.json({
      success: true,
      message: "IMAP settings configured successfully! You can now use fast IMAP scanning.",
    });
  } catch (error: any) {
    console.error("Save IMAP settings error:", error);
    return NextResponse.json({ error: "Failed to save IMAP settings" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const deleteProgress = url.searchParams.get("progress") === "true";

  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { email } = await getGmailClient(refreshToken);

    if (deleteProgress) {
      // Delete progress to reset scan
      await deleteIMAPProgress(email);
      return NextResponse.json({
        success: true,
        message: "IMAP progress reset. Next scan will start from beginning.",
      });
    } else {
      // Delete settings
      await deleteIMAPSettings(email);
      await deleteIMAPProgress(email); // Also delete progress
      return NextResponse.json({
        success: true,
        message: "IMAP settings and progress removed.",
      });
    }
  } catch (error: any) {
    console.error("Delete IMAP settings/progress error:", error);
    return NextResponse.json({ error: "Failed to delete IMAP data" }, { status: 500 });
  }
