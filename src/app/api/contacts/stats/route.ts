import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";
import { loadContactSnapshot } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { email } = await getGmailClient(refreshToken);

    // Get contact statistics from Firestore
    const contactSnapshot = await loadContactSnapshot(email);

    if (!contactSnapshot) {
      return NextResponse.json({
        totalContacts: 0,
        messagesProcessed: 0,
        sendersCount: 0,
        recipientsCount: 0,
        lastUpdated: null,
      });
    }

    return NextResponse.json({
      totalContacts: contactSnapshot.merged.length,
      messagesProcessed: contactSnapshot.messageSampleCount,
      sendersCount: contactSnapshot.senders.length,
      recipientsCount: contactSnapshot.recipients.length,
      lastUpdated: contactSnapshot.updatedAt,
    });
  } catch (error: any) {
    console.error("Contacts stats error:", error);
    return NextResponse.json({ error: "Failed to load contact statistics" }, { status: 500 });
  }
}
