import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const resolvedParams = await params;

    await gmail.users.settings.filters.delete({
      userId: "me",
      id: resolvedParams.id,
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
