import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveContactSnapshot } from "@/lib/firestore";
import { extractAddressesFromMessage } from "@/lib/gmail";
import { getGmailClient } from "@/lib/google";

const MESSAGE_LIMIT = 60;

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail, email } = await getGmailClient(refreshToken);

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: MESSAGE_LIMIT,
      q: "newer_than:365d",
    });

    const messageIds = list.data.messages?.map((m) => m.id).filter(Boolean) || [];

    const details = await Promise.all(
      messageIds.map(async (id) => {
        const res = await gmail.users.messages.get({
          userId: "me",
          id: id as string,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Bcc"],
        });
        return res.data;
      }),
    );

    const senders = new Set<string>();
    const recipients = new Set<string>();

    details.forEach((message) => {
      const parsed = extractAddressesFromMessage(message);
      parsed.senders.forEach((addr) => senders.add(addr));
      parsed.recipients.forEach((addr) => recipients.add(addr));
    });

    const merged = new Set([...senders, ...recipients]);
    const snapshot = {
      senders: Array.from(senders).sort(),
      recipients: Array.from(recipients).sort(),
      merged: Array.from(merged).sort(),
      messageSampleCount: messageIds.length,
      updatedAt: new Date().toISOString(),
    };

    await saveContactSnapshot(email, snapshot);

    return NextResponse.json({ email, ...snapshot });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to sync Gmail messages" },
      { status: 500 },
    );
  }
}

