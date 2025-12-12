import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadFilters, saveFilter, deleteFilter, saveLabel, type GmailFilter, loadLabels } from "@/lib/firestore";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

// Helper function to get the current user's email
async function getCurrentUserEmail(): Promise<string> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return "";
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress || "";
  } catch (error) {
    return "";
  }
}

export async function GET() {
  try {
    const email = await getCurrentUserEmail();
    if (!email) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const filters = await loadFilters(email);
    return NextResponse.json({ filters });
  } catch (error: any) {
    console.error("[Firestore Filters API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to load filters",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    if (!email) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const data = await request.json();
    const { name, query, labelIds, archive, createLabel, labelName } = data;

    if (!name || !query) {
      return NextResponse.json({ error: "name and query are required" }, { status: 400 });
    }

    // If createLabel is requested, create the label in Firestore first
    let finalLabelIds = labelIds || [];
    if (createLabel && labelName) {
      const labelId = `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save the label to Firestore
      const newLabel = {
        id: labelId,
        name: labelName,
        type: "user" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveLabel(email, newLabel);
      finalLabelIds = [labelId];
    }

    const now = new Date().toISOString();
    const filter: GmailFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      labelIds: finalLabelIds,
      archive,
      createdAt: now,
      updatedAt: now,
      status: "draft",
    };

    await saveFilter(email, filter);

    return NextResponse.json({ filter });
  } catch (error: any) {
    console.error("[Firestore Filters API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to create filter",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    if (!email) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const data = await request.json();
    const { filterId } = data;

    if (!filterId) {
      return NextResponse.json({ error: "filterId is required" }, { status: 400 });
    }

    // Load the current filter
    const filters = await loadFilters(email);
    const currentFilter = filters.find((f) => f.id === filterId);

    if (!currentFilter) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    // For this endpoint, we're publishing the filter to Gmail
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { gmail } = await getGmailClient(refreshToken);

    // Load labels to resolve label names from IDs and ensure they exist in Gmail
    const firestoreLabels = await loadLabels(email);

    // Ensure all filter labels exist in Gmail before creating the filter
    const validatedLabelIds: string[] = [];
    for (const filterLabelId of currentFilter.labelIds || []) {
      const firestoreLabel = firestoreLabels.find((l) => l.id === filterLabelId);
      if (!firestoreLabel) {
        throw new Error(`Label ${filterLabelId} not found in database`);
      }

      // Check if label exists in Gmail
      try {
        await gmail.users.labels.get({
          userId: "me",
          id: filterLabelId,
        });
        // Label exists in Gmail, add to validated list
        validatedLabelIds.push(filterLabelId);
      } catch (error: any) {
        // Label doesn't exist in Gmail, create it first
        if (error.code === 404) {
          const createLabelResponse = await gmail.users.labels.create({
            userId: "me",
            requestBody: {
              name: firestoreLabel.name,
              color: firestoreLabel.color
                ? {
                    textColor: firestoreLabel.color.textColor,
                    backgroundColor: firestoreLabel.color.backgroundColor,
                  }
                : undefined,
              labelListVisibility: firestoreLabel.labelListVisibility,
              messageListVisibility: firestoreLabel.messageListVisibility,
            },
          });

          // Use the Gmail-assigned ID (might be different from Firestore ID)
          const gmailLabelId = createLabelResponse.data.id;
          if (gmailLabelId) {
            validatedLabelIds.push(gmailLabelId);

            // Update the filter in Firestore to use the correct Gmail label ID
            const updatedLabelIds = currentFilter.labelIds?.map((id) => (id === filterLabelId ? gmailLabelId : id));
            currentFilter.labelIds = updatedLabelIds;
          }
        } else {
          throw error;
        }
      }
    }

    const action: any = {};

    if (validatedLabelIds.length > 0) {
      action.addLabelIds = validatedLabelIds;
    }

    if (currentFilter.archive) {
      // Archive action - this moves messages to trash
      action.removeLabelIds = ["INBOX"];
    }

    // Always use the from field for all filters
    const criteria = {
      from: currentFilter.query,
    };

    const filterData = {
      filter: {
        criteria,
        action,
      },
    };

    const response = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: filterData.filter,
    });

    // Update the filter in Firestore with the Gmail ID and published status
    const updatedFilter: GmailFilter = {
      ...currentFilter,
      gmailId: response.data.id || undefined,
      status: "published",
      updatedAt: new Date().toISOString(),
    };

    await saveFilter(email, updatedFilter);

    return NextResponse.json({
      filter: updatedFilter,
      gmailFilter: response.data,
    });
  } catch (error: any) {
    console.error("[Firestore Filters API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to publish filter to Gmail",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
