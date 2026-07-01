import { prisma } from "@/lib/prisma";
import { partnerIsActive } from "@/lib/operations/attention";
import { deriveAdvisingLifecycle } from "@/lib/advising/relationship";

import { STALE_RECOMMENDATION_DAYS } from "./mentorship-analytics-core";
import type { AttentionFact, AttentionGroup, AttentionLabel } from "./types";

/**
 * Data 360 — Needs Attention (factual, score-free).
 *
 * Every item is a concrete fact about a real record — "this active chapter has
 * no published classes", "this action is 6 days past its deadline". There is NO
 * severity score and NO quality grade. `order` is a real quantity (days
 * overdue, headcount short) used only to sort within a label group. Plain
 * labels, exactly as the brief requires.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PARTNER_QUIET_DAYS = 60;
/** Max facts surfaced per label, so the panel stays readable. */
const PER_LABEL_CAP = 5;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

const ACTIVE_CLASS_STATUSES = ["PUBLISHED", "IN_PROGRESS"] as const;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export const ATTENTION_HINTS: Partial<Record<AttentionLabel, string>> = {
  Overdue: "Past their deadline",
  "Awaiting review": "Applications waiting on YPP",
  "No active classes": "Active chapters with nothing running",
  "Low enrollment": "Below the class minimum",
  "No recent activity": "No contact logged recently",
  "No follow-up": "Completed meetings with no next step",
  "No advisor": "Students with no active advisor",
  "Kickoff overdue": "Assigned students still waiting on a first check-in",
  "Overdue check-in": "Advising relationships past a check-in",
  "Stale recommendation": "Advisor recommendations gone quiet",
};

export async function loadNeedsAttention(now: Date): Promise<AttentionFact[]> {
  const [
    overdue,
    activeChapters,
    chapterIdsWithClasses,
    lowEnrollment,
    awaiting,
    partners,
    meetingsNoFollowUp,
    advisingAssignments,
    advisingStudents,
    staleRecommendations,
  ] = await Promise.all([
    safe(
      prisma.actionItem.findMany({
        where: {
          OR: [
            { status: "OVERDUE" },
            { status: { in: ["NOT_STARTED", "IN_PROGRESS"] }, deadlineEnd: { lt: now } },
          ],
        },
        orderBy: { deadlineEnd: "asc" },
        take: PER_LABEL_CAP,
        select: { id: true, title: true, deadlineEnd: true },
      }),
      [] as Array<{ id: string; title: string; deadlineEnd: Date | null }>
    ),
    safe(
      prisma.chapter.findMany({
        where: { archivedAt: null, lifecycleStatus: "ACTIVE" },
        select: { id: true, name: true, state: true },
      }),
      [] as Array<{ id: string; name: string; state: string | null }>
    ),
    safe(
      prisma.classOffering.findMany({
        where: { status: { in: [...ACTIVE_CLASS_STATUSES] } },
        select: { chapterId: true },
        distinct: ["chapterId"],
      }),
      [] as Array<{ chapterId: string | null }>
    ),
    safe(
      prisma.classOffering.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          template: { select: { minStudents: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      [] as Array<{
        id: string;
        title: string;
        template: { minStudents: number } | null;
        _count: { enrollments: number };
      }>
    ),
    safe(
      prisma.instructorApplication.findMany({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        take: PER_LABEL_CAP,
        select: {
          id: true,
          preferredFirstName: true,
          lastName: true,
          legalName: true,
          createdAt: true,
        },
      }),
      [] as Array<{
        id: string;
        preferredFirstName: string | null;
        lastName: string | null;
        legalName: string | null;
        createdAt: Date;
      }>
    ),
    safe(
      prisma.partner.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          stage: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
        },
      }),
      [] as Array<{
        id: string;
        name: string;
        stage: string | null;
        nextFollowUpAt: Date | null;
        lastContactedAt: Date | null;
      }>
    ),
    safe(
      prisma.meeting.findMany({
        where: { status: "COMPLETED" },
        orderBy: { scheduledAt: "desc" },
        take: 60,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          _count: { select: { followUps: true } },
        },
      }),
      [] as Array<{
        id: string;
        title: string;
        scheduledAt: Date;
        _count: { followUps: number };
      }>
    ),
    safe(
      prisma.studentAdvisorAssignment.findMany({
        where: { isActive: true },
        select: {
          id: true,
          advisingStatus: true,
          needsFollowUp: true,
          followUpNote: true,
          lastCheckInAt: true,
          nextCheckInDueAt: true,
          startDate: true,
          studentId: true,
          student: { select: { name: true } },
        },
      }),
      [] as Array<{
        id: string;
        advisingStatus: "ENGAGED" | "NEEDS_ATTENTION" | "INACTIVE" | "READY_FOR_NEXT";
        needsFollowUp: boolean;
        followUpNote: string | null;
        lastCheckInAt: Date | null;
        nextCheckInDueAt: Date | null;
        startDate: Date;
        studentId: string;
        student: { name: string } | null;
      }>
    ),
    safe(
      prisma.user.findMany({
        where: { archivedAt: null, roles: { some: { role: "STUDENT" } } },
        select: { id: true, name: true },
      }),
      [] as Array<{ id: string; name: string }>
    ),
    safe(
      prisma.advisingRecommendation.findMany({
        where: {
          status: "SUGGESTED",
          createdAt: { lt: new Date(now.getTime() - STALE_RECOMMENDATION_DAYS * DAY_MS) },
        },
        orderBy: { createdAt: "asc" },
        take: PER_LABEL_CAP,
        select: {
          id: true,
          title: true,
          createdAt: true,
          assignment: { select: { student: { select: { name: true } } } },
        },
      }),
      [] as Array<{
        id: string;
        title: string;
        createdAt: Date;
        assignment: { student: { name: string } | null } | null;
      }>
    ),
  ]);

  const facts: AttentionFact[] = [];

  // Overdue actions
  for (const a of overdue) {
    const days = a.deadlineEnd ? daysBetween(a.deadlineEnd, now) : 0;
    facts.push({
      id: `action:${a.id}`,
      kind: "action",
      label: "Overdue",
      title: a.title,
      detail: days > 0 ? `${days} day${days === 1 ? "" : "s"} past its deadline` : "Past its deadline",
      href: "/actions/all?status=OVERDUE",
      order: days,
    });
  }

  // Active chapters with no active classes
  const withClasses = new Set(
    chapterIdsWithClasses.map((r) => r.chapterId).filter((id): id is string => Boolean(id))
  );
  const noClassChapters = activeChapters.filter((c) => !withClasses.has(c.id));
  for (const c of noClassChapters.slice(0, PER_LABEL_CAP)) {
    facts.push({
      id: `chapter:${c.id}`,
      kind: "chapter",
      label: "No active classes",
      title: c.name,
      detail: `Active chapter${c.state ? ` in ${c.state}` : ""} with no published or in-progress classes`,
      href: "/admin/chapters",
      order: 1,
    });
  }

  // Classes under the enrollment minimum
  const lowList = lowEnrollment
    .map((c) => {
      const min = c.template?.minStudents ?? 0;
      const enrolled = c._count.enrollments;
      return { ...c, min, enrolled, shortfall: min - enrolled };
    })
    .filter((c) => c.min > 0 && c.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall)
    .slice(0, PER_LABEL_CAP);
  for (const c of lowList) {
    facts.push({
      id: `class:${c.id}`,
      kind: "class",
      label: "Low enrollment",
      title: c.title,
      detail: `${c.enrolled} enrolled · minimum ${c.min}`,
      href: "/admin/classes",
      order: c.shortfall,
    });
  }

  // Applications awaiting review
  for (const a of awaiting) {
    const days = daysBetween(a.createdAt, now);
    const name =
      [a.preferredFirstName, a.lastName].filter(Boolean).join(" ").trim() ||
      a.legalName ||
      "Applicant";
    facts.push({
      id: `applicant:${a.id}`,
      kind: "applicant",
      label: "Awaiting review",
      title: name,
      detail: `Submitted ${days} day${days === 1 ? "" : "s"} ago, not yet reviewed`,
      href: "/admin/instructor-applicants",
      order: days,
    });
  }

  // Active partners with no recent activity
  const quietPartners = partners
    .filter((p) =>
      partnerIsActive({
        id: p.id,
        name: p.name,
        stage: p.stage,
        nextFollowUpAt: p.nextFollowUpAt,
        lastContactedAt: p.lastContactedAt,
        relationshipLeadName: null,
      })
    )
    .map((p) => ({
      ...p,
      quietDays: p.lastContactedAt ? daysBetween(p.lastContactedAt, now) : Number.MAX_SAFE_INTEGER,
    }))
    .filter((p) => p.quietDays >= PARTNER_QUIET_DAYS)
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, PER_LABEL_CAP);
  for (const p of quietPartners) {
    facts.push({
      id: `partner:${p.id}`,
      kind: "partner",
      label: "No recent activity",
      title: p.name,
      detail:
        p.quietDays === Number.MAX_SAFE_INTEGER
          ? "No contact ever logged"
          : `No contact in ${p.quietDays} days`,
      href: "/partners",
      order: p.quietDays === Number.MAX_SAFE_INTEGER ? 9999 : p.quietDays,
    });
  }

  // Completed meetings with no follow-up
  const noFollowUp = meetingsNoFollowUp
    .filter((m) => m._count.followUps === 0)
    .slice(0, PER_LABEL_CAP);
  for (const m of noFollowUp) {
    facts.push({
      id: `meeting:${m.id}`,
      kind: "meeting",
      label: "No follow-up",
      title: m.title,
      detail: "Completed meeting with no follow-ups recorded",
      href: "/meetings",
      order: 1,
    });
  }

  // ── Advising (student mentorship) — only once advising is actually running ──
  if (advisingAssignments.length > 0) {
    // Students with no active advisor.
    const advisedIds = new Set(advisingAssignments.map((a) => a.studentId));
    const unadvised = advisingStudents.filter((s) => !advisedIds.has(s.id)).slice(0, PER_LABEL_CAP);
    for (const s of unadvised) {
      facts.push({
        id: `advising-unassigned:${s.id}`,
        kind: "student",
        label: "No advisor",
        title: s.name,
        detail: "No active advisor assigned",
        href: "/operations/advising?lane=needs_advisor",
        order: 1,
      });
    }

    // Lifecycle per active relationship, via the advising cockpit's own logic —
    // the SAME source of truth the mentorship metrics use, so the buckets line
    // up: a never-started kickoff is "Kickoff overdue" (its own lane), while a
    // lapsed/stale check-in is "Overdue check-in". Splitting them keeps each
    // fact's drill-down landing in the lane that actually contains the student.
    const lived = advisingAssignments.map((a) => ({
      a,
      life: deriveAdvisingLifecycle(
        {
          isActive: true,
          advisingStatus: a.advisingStatus,
          needsFollowUp: a.needsFollowUp,
          followUpNote: a.followUpNote,
          lastCheckInAt: a.lastCheckInAt,
          nextCheckInDueAt: a.nextCheckInDueAt,
          startDate: a.startDate,
        },
        now
      ),
    }));

    // Overdue kickoffs (assigned, never checked in, past the grace window) —
    // core counts these as `kickoffsNeeded`, a separate metric, and the cockpit
    // routes them to the `kickoff_needed` lane.
    const kickoffOverdue = lived
      .filter(({ life }) => life.lifecycle === "KICKOFF_NEEDED" && life.tone === "danger")
      .map(({ a, life }) => ({ a, life, order: life.daysSinceStart }))
      .sort((x, y) => y.order - x.order)
      .slice(0, PER_LABEL_CAP);
    for (const { a, life, order } of kickoffOverdue) {
      facts.push({
        id: `advising-kickoff:${a.id}`,
        kind: "student",
        label: "Kickoff overdue",
        title: a.student?.name ?? "Student",
        detail: life.reason,
        href: "/operations/advising?lane=kickoff_needed",
        order,
      });
    }

    // Lapsed check-ins (follow-up due or gone stale) — core's `overdueCheckIns`.
    const overdueCheckIns = lived
      .filter(({ life }) => life.lifecycle === "FOLLOW_UP_DUE" || life.lifecycle === "STALE")
      .map(({ a, life }) => ({ a, life, order: life.daysSinceCheckIn ?? life.daysSinceStart }))
      .sort((x, y) => y.order - x.order)
      .slice(0, PER_LABEL_CAP);
    for (const { a, life, order } of overdueCheckIns) {
      facts.push({
        id: `advising-overdue:${a.id}`,
        kind: "student",
        label: "Overdue check-in",
        title: a.student?.name ?? "Student",
        detail: life.reason,
        href: "/operations/advising?lane=follow_up_due",
        order,
      });
    }
  }

  // Advisor recommendations that have gone stale (no action).
  for (const r of staleRecommendations) {
    const days = daysBetween(r.createdAt, now);
    facts.push({
      id: `advising-rec:${r.id}`,
      kind: "recommendation",
      label: "Stale recommendation",
      title: r.title,
      detail: `${r.assignment?.student?.name ?? "A student"} · suggested ${days} day${days === 1 ? "" : "s"} ago, no action yet`,
      href: "/operations/advising?lane=recommendations_ready",
      order: days,
    });
  }

  return facts;
}

/** Group an attention list by label, preserving worst-first order within each. */
export function groupAttention(facts: AttentionFact[]): AttentionGroup[] {
  const byLabel = new Map<AttentionLabel, AttentionFact[]>();
  for (const f of facts) {
    const list = byLabel.get(f.label) ?? [];
    list.push(f);
    byLabel.set(f.label, list);
  }
  return Array.from(byLabel.entries())
    .map(([label, items]) => ({
      label,
      hint: ATTENTION_HINTS[label] ?? "",
      facts: items.sort((a, b) => b.order - a.order),
    }))
    .sort((a, b) => b.facts.length - a.facts.length);
}
