import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActivityFeedForUser } from "@/lib/activity-hub/actions";
import type { ActivitySourceType } from "@/lib/activity-hub/types";

const SOURCE_TYPES: ActivitySourceType[] = [
  "PORTAL_CHALLENGE",
  "TALENT_CHALLENGE",
  "TRY_IT_SESSION",
  "INCUBATOR_PROJECT",
  "PROJECT_TRACKER",
];

function parseSourceTypes(searchParams: URLSearchParams): ActivitySourceType[] | undefined {
  const values = [
    ...searchParams.getAll("sourceType"),
    ...String(searchParams.get("sourceTypes") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  const unique = Array.from(new Set(values))
    .filter((value): value is ActivitySourceType => SOURCE_TYPES.includes(value as ActivitySourceType));
  return unique.length > 0 ? unique : undefined;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const passionId = searchParams.get("passionId") || undefined;
  const includeDraft = searchParams.get("includeDraft") === "true";
  const limit = Number.parseInt(searchParams.get("limit") || "", 10);

  const feed = await getActivityFeedForUser(session.user.id, {
    passionId,
    includeDraft,
    sourceTypes: parseSourceTypes(searchParams),
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json(feed);
}
