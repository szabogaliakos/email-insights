import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";
import { loadIMAPProgress } from "@/lib/firestore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { email } = await getGmailClient(refreshToken);
    const progress = await loadIMAPProgress(email);

    if (!progress) {
      return NextResponse.json({
        hasProgress: false,
        message: "No scan in progress. Start a new IMAP scan.",
        lastMessageScanned: 0,
        contactsFound: 0,
        isComplete: false,
      });
    }

    return NextResponse.json({
      hasProgress: true,
      ...progress,
    });
  } catch (error: any) {
    console.error("Load IMAP progress error:", error);
    return NextResponse.json({ error: "Failed to load IMAP progress" }, { status: 500 });
  }
}
