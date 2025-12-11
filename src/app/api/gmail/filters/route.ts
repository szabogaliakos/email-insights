import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);

    const response = await gmail.users.settings.filters.list({
      userId: "me",
    });

    return NextResponse.json({
      filters: response.data.filter || [],
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to fetch filters",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const data = await request.json();

    const response = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: data.filter,
    });

    return NextResponse.json({
      filter: response.data,
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to create filter",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
