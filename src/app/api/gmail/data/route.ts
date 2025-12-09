import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadContactSnapshot } from "@/lib/firestore";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const snapshot = await loadContactSnapshot(email);

    if (!snapshot) {
      return NextResponse.json({
        email,
        senders: [],
        recipients: [],
        merged: [],
        messageSampleCount: 0,
        updatedAt: null,
      });
    }

    return NextResponse.json({ email, ...snapshot });
  } catch (error: any) {
    console.error("[Firestore Error]", error);
    const errorMessage = error?.message || "Unknown error";
    return NextResponse.json(
      { 
        error: "Unable to load data from Firestore",
        details: errorMessage.includes("DECODER") || errorMessage.includes("private key")
          ? "Check your FIRESTORE_PRIVATE_KEY format in .env.local. See README for correct format."
          : errorMessage
      },
      { status: 500 },
    );
  }
}

