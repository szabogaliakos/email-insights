import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { saveLabel, deleteLabel, loadLabels } from "@/lib/firestore";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { id: labelId } = await params;

  try {
    const { email } = await getGmailClient(refreshToken);
    const body = await request.json();
    const { name, parentId, color, labelListVisibility, messageListVisibility } = body;

    if (!name) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    // Load existing label to merge
    const labels = await loadLabels(email);
    const existingLabel = labels.find((l) => l.id === labelId);

    if (!existingLabel) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const updatedLabel: any = {
      ...existingLabel,
      name,
      updatedAt: new Date().toISOString(),
    };

    // Only include fields that are defined
    if (parentId !== undefined) updatedLabel.parentId = parentId;
    if (color !== undefined) updatedLabel.color = color;
    if (labelListVisibility !== undefined) updatedLabel.labelListVisibility = labelListVisibility;
    if (messageListVisibility !== undefined) updatedLabel.messageListVisibility = messageListVisibility;

    await saveLabel(email, updatedLabel);
    return NextResponse.json({ label: updatedLabel });
  } catch (error: any) {
    console.error("Failed to update label:", error);
    return NextResponse.json({ error: "Failed to update label" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { id: labelId } = await params;

  try {
    const { email } = await getGmailClient(refreshToken);
    await deleteLabel(email, labelId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete label:", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}
