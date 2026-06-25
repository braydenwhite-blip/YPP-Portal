// Chapter data-integrity detection. Surfaces the orphans and gaps that quietly
// break the operating graph — an approved CP with no chapter, a chapter with no
// president, an open support request that never became an action, duplicate
// chapters for one school — each with a concrete fix path. Leadership-only.
//
// Pure-ish reads with per-check try/catch so one bad query never blanks the set.

import "server-only";

import { prisma } from "@/lib/prisma";

/** CP application statuses that should already have a provisioned chapter. */
const APPROVED_APP_STATUSES = ["ACCEPTED", "APPROVED", "ONBOARDING", "ACTIVE_CP"];
const OPERATING_STATUSES = ["LAUNCHING", "ACTIVE", "NEEDS_SUPPORT", "AT_RISK"] as const;

export type ChapterIntegrityKind =
  | "approved_app_no_chapter"
  | "chapter_no_president"
  | "support_no_action"
  | "duplicate_school"
  | "chapter_no_members";

export type ChapterIntegrityIssue = {
  kind: ChapterIntegrityKind;
  /** Stable id of the offending record (application / chapter / support request / school). */
  refId: string;
  title: string;
  detail: string;
  severity: "warning" | "danger";
  /** Deep link to where a human resolves it. */
  href: string;
  /** When true, a one-click server repair exists (repairChapterDataIssue). */
  repairable: boolean;
};

function appName(app: {
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
}): string {
  const composed = [app.preferredFirstName, app.lastName].filter(Boolean).join(" ").trim();
  return composed || app.legalName?.trim() || "CP applicant";
}

/**
 * Detect chapter data-integrity issues across the operating graph. Returns an
 * empty array on a clean system (so the caller renders nothing).
 */
export async function loadChapterIntegrityIssues(): Promise<ChapterIntegrityIssue[]> {
  const issues: ChapterIntegrityIssue[] = [];

  // 1. Approved CP application with no chapter — the launch never got an operating unit.
  try {
    const apps = await prisma.chapterPresidentApplication.findMany({
      where: { status: { in: APPROVED_APP_STATUSES as never }, chapterId: null },
      select: { id: true, preferredFirstName: true, lastName: true, legalName: true },
      take: 50,
    });
    for (const app of apps) {
      issues.push({
        kind: "approved_app_no_chapter",
        refId: app.id,
        title: `${appName(app)} is approved but has no chapter`,
        detail: "Provision the chapter so launch tasks, meetings, and actions have a home.",
        severity: "danger",
        href: `/admin/chapter-president-applicants/${app.id}`,
        repairable: true,
      });
    }
  } catch {
    /* tolerate schema drift */
  }

  // 2. Operating/launching chapter with no Chapter President.
  try {
    const chapters = await prisma.chapter.findMany({
      where: {
        archivedAt: null,
        presidentId: null,
        lifecycleStatus: { in: OPERATING_STATUSES as never },
      },
      select: { id: true, name: true },
      take: 50,
    });
    for (const c of chapters) {
      issues.push({
        kind: "chapter_no_president",
        refId: c.id,
        title: `${c.name} has no Chapter President`,
        detail: "Assign or link a CP — every operating chapter needs an accountable owner.",
        severity: "danger",
        href: `/admin/chapters/${c.id}`,
        repairable: false,
      });
    }
  } catch {
    /* tolerate */
  }

  // 3. Open support request with no linked action — an ask with no tracked work.
  try {
    const reqs = await prisma.chapterSupportRequest.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, actionItemId: null },
      select: { id: true, title: true, chapterId: true, chapter: { select: { name: true } } },
      take: 50,
    });
    for (const r of reqs) {
      issues.push({
        kind: "support_no_action",
        refId: r.id,
        title: `Support request "${r.title}" has no action`,
        detail: `${r.chapter?.name ?? "Chapter"} — create the tracked action so it gets an owner and a due date.`,
        severity: "warning",
        href: `/admin/chapters/${r.chapterId}`,
        repairable: true,
      });
    }
  } catch {
    /* tolerate */
  }

  // 4. Duplicate active chapters for the same partner school.
  try {
    const grouped = await prisma.chapter.groupBy({
      by: ["partnerSchool"],
      where: { archivedAt: null, partnerSchool: { not: null } },
      _count: { _all: true },
      having: { partnerSchool: { _count: { gt: 1 } } },
    });
    for (const g of grouped) {
      if (!g.partnerSchool) continue;
      issues.push({
        kind: "duplicate_school",
        refId: g.partnerSchool,
        title: `${g._count._all} chapters share the school "${g.partnerSchool}"`,
        detail: "Merge or archive the duplicates so the school maps to one operating unit.",
        severity: "warning",
        href: `/admin/chapters?q=${encodeURIComponent(g.partnerSchool)}`,
        repairable: false,
      });
    }
  } catch {
    /* tolerate */
  }

  // 5. Operating chapter with no members.
  try {
    const chapters = await prisma.chapter.findMany({
      where: {
        archivedAt: null,
        lifecycleStatus: { in: ["ACTIVE", "NEEDS_SUPPORT", "AT_RISK"] as never },
        users: { none: {} },
      },
      select: { id: true, name: true },
      take: 50,
    });
    for (const c of chapters) {
      issues.push({
        kind: "chapter_no_members",
        refId: c.id,
        title: `${c.name} is active but has no members`,
        detail: "Add or import members, or move the chapter back to Launching.",
        severity: "warning",
        href: `/admin/chapters/${c.id}`,
        repairable: false,
      });
    }
  } catch {
    /* tolerate */
  }

  return issues;
}
