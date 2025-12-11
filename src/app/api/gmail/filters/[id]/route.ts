import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const data = await request.json();

    const response = await gmail.users.settings.filters.update({
      userId: "me",
      id: params.id,
      requestBody: data.filter,
    });

    return NextResponse.json({
      filter: response.data,
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to update filter",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);

    await gmail.users.settings.filters.delete({
      userId: "me",
      id: params.id,
    });

    return NextResponse.json({
      success: true,
      message: "Filter deleted successfully",
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to delete filter",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
