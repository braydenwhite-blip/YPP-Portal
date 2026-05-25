import { redirect } from "next/navigation";

import ActionCenterSubNav from "@/components/leadership-action-center/sub-nav";
import ActionCenterSectionHeader from "@/components/leadership-action-center/section-header";
import WeeklyDigestClient, {
  toClientPayload,
} from "@/components/leadership-action-center/weekly-digest-client";
import { MEETING_KIND_LABELS } from "@/lib/leadership-action-center/constants";
import {
  endOfDay,
  endOfOperatingWeek,
  parseDateInput,
  startOfOperatingWeek,
  toDateInputValue,
} from "@/lib/leadership-action-center/dates";
import { buildWeeklyDigest } from "@/lib/leadership-action-center/digest";
import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import { listActionItems, listMeetings } from "@/lib/leadership-action-center/queries";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly Digest · Leadership Action Center" };

export default async function WeeklyDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getLeadershipSession();
  if (!session) redirect("/");

  const params = await searchParams;
  const requested = params.week ? parseDateInput(params.week) : null;
  const baseDate = requested ?? new Date();
  const weekStart = startOfOperatingWeek(baseDate);
  const weekEnd = endOfOperatingWeek(baseDate);

  // Pull every task whose due date OR weekStart falls inside the operating
  // week. We OR the two so backlog items intentionally pinned to a week
  // still show up even if they have no concrete deadline.
  const items = await prisma.leadershipActionItem.findMany({
    where: {
      archivedAt: null,
      OR: [
        { dueDate: { gte: weekStart, lte: weekEnd } },
        { weekStart: weekStart },
      ],
    },
    include: {
      primaryOwner: { select: { id: true, name: true, email: true } },
      meeting: { select: { id: true, title: true, kind: true } },
      inputNeededFrom: {
        select: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { updates: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
  });

  const meetings = await prisma.leadershipMeeting.findMany({
    where: {
      archivedAt: null,
      scheduledAt: { gte: weekStart, lte: endOfDay(weekEnd) },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { actionItems: true } },
    },
    orderBy: [{ scheduledAt: "asc" }],
  });

  const digest = buildWeeklyDigest({
    weekStart,
    weekEnd,
    generatedAt: new Date(),
    actionItems: items,
    meetings,
  });

  const payload = toClientPayload(digest, weekStart, weekEnd, MEETING_KIND_LABELS);

  // Quick navigation: prev/next/this week
  const previousWeekDate = new Date(weekStart);
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const nextWeekDate = new Date(weekStart);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);

  return (
    <div className="page-shell">
      <ActionCenterSectionHeader
        badge="Admin · Leadership"
        title="Weekly digest"
        description="Generated from the live tracker. Edit the plain text version before copying into email or Slack."
        actions={[
          { label: "← This week", href: "/admin/action-center/weekly" },
        ]}
      />
      <ActionCenterSubNav />

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Link
          href={`/admin/action-center/weekly?week=${toDateInputValue(previousWeekDate)}`}
          className="button outline small"
        >
          ← Previous week
        </Link>
        <Link
          href={`/admin/action-center/weekly?week=${toDateInputValue(nextWeekDate)}`}
          className="button outline small"
        >
          Next week →
        </Link>
        <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>
          Tasks listed have a deadline in this week or are pinned to the operating week.
        </span>
      </div>

      <WeeklyDigestClient digest={payload} />
    </div>
  );
}
