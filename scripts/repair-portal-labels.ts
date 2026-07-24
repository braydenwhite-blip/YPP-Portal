/**
 * Portal label / relationship repair for the HIGH PRIORITY cleanup.
 *
 * Dry-run by default. Re-run with --apply to commit.
 *
 * Fixes (known):
 * - Mentor map: Zach ← Anthea, Ian; Sam ← Aveena, Brayden, Sanvi
 * - Jackson canonicalTitle → Director
 * - Reports chapter + Function/Department gaps (does not auto-guess Function)
 *
 * Usage:
 *   npx tsx scripts/repair-portal-labels.ts
 *   npx tsx scripts/repair-portal-labels.ts --apply
 */

import "dotenv/config";

import { MentorshipType } from "@prisma/client";

import { ensureOperatingChapters, planUserChapterRepairs } from "@/lib/chapters/operating";
import { TITLE_AUTHORITY } from "@/lib/org/levels";
import {
  buildMentorTransferPlan,
  type CurrentAssignment,
} from "@/lib/mentorship-transfer";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const MENTOR_TARGETS: Array<{ mentorFirst: string; menteeFirsts: string[] }> = [
  { mentorFirst: "Zach", menteeFirsts: ["Anthea", "Ian"] },
  { mentorFirst: "Sam", menteeFirsts: ["Aveena", "Brayden", "Sanvi"] },
];

type NamedUser = { id: string; name: string; email: string; primaryRole: string };

function firstToken(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

async function resolveByFirstName(first: string): Promise<NamedUser[]> {
  const rows = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { name: { startsWith: first, mode: "insensitive" } },
        { name: { contains: first, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  // Prefer exact first-token match (e.g. "Ian" not "Ianna").
  const exact = rows.filter((r) => firstToken(r.name) === first.toLowerCase());
  return exact.length > 0 ? exact : rows;
}

function pickOne(label: string, matches: NamedUser[]): NamedUser | null {
  if (matches.length === 0) {
    console.warn(`  ! No user found for ${label} — skip (check remote DB)`);
    return null;
  }
  if (matches.length > 1) {
    console.warn(
      `  ! Multiple matches for ${label}; using first:\n` +
        matches.map((m) => `      - ${m.name} <${m.email}> (${m.primaryRole})`).join("\n")
    );
  }
  return matches[0]!;
}

async function reassignMentorCore(args: {
  menteeId: string;
  newMentorId: string;
  reason: string;
  actorId: string | null;
}): Promise<"reassigned" | "unchanged"> {
  const existing = await prisma.mentorship.findFirst({
    where: { menteeId: args.menteeId, status: "ACTIVE", focusArea: null },
    select: { id: true, mentorId: true, focusArea: true, type: true, startDate: true },
    orderBy: { startDate: "desc" },
  });

  const current: CurrentAssignment | null = existing
    ? { mentorshipId: existing.id, mentorId: existing.mentorId, focusArea: existing.focusArea }
    : null;

  const plan = buildMentorTransferPlan(current, {
    menteeId: args.menteeId,
    newMentorId: args.newMentorId,
    focusArea: null,
    isTemporary: false,
  });

  if (plan.noop) return "unchanged";

  const now = new Date();
  const mentorshipType: MentorshipType = existing?.type ?? MentorshipType.INSTRUCTOR;

  await prisma.$transaction(async (tx) => {
    if (plan.completeMentorshipId) {
      await tx.mentorship.update({
        where: { id: plan.completeMentorshipId },
        data: { status: "COMPLETE", endDate: now },
      });
    }

    const created = await tx.mentorship.create({
      data: {
        mentorId: args.newMentorId,
        menteeId: args.menteeId,
        type: mentorshipType,
        focusArea: null,
        isTemporary: false,
        notes: args.reason,
      },
      select: { id: true },
    });

    if (plan.previousMentorId && plan.previousMentorId !== args.newMentorId) {
      const closed = await tx.mentorshipAssignmentHistory.updateMany({
        where: {
          menteeId: args.menteeId,
          focusArea: null,
          mentorId: plan.previousMentorId,
          endedAt: null,
        },
        data: { endedAt: now },
      });
      if (closed.count === 0) {
        await tx.mentorshipAssignmentHistory.create({
          data: {
            menteeId: args.menteeId,
            mentorId: plan.previousMentorId,
            focusArea: null,
            role: "PRIMARY_MENTOR",
            mentorshipId: plan.completeMentorshipId,
            startedAt: existing?.startDate ?? now,
            endedAt: now,
            reason: "Closed on reassignment (portal label repair).",
            actorId: args.actorId,
          },
        });
      }
    }

    await tx.mentorshipAssignmentHistory.updateMany({
      where: {
        menteeId: args.menteeId,
        focusArea: null,
        endedAt: null,
        mentorId: { not: args.newMentorId },
      },
      data: { endedAt: now },
    });

    const open = await tx.mentorshipAssignmentHistory.findFirst({
      where: {
        menteeId: args.menteeId,
        focusArea: null,
        mentorId: args.newMentorId,
        endedAt: null,
      },
      select: { id: true },
    });
    if (!open) {
      await tx.mentorshipAssignmentHistory.create({
        data: {
          menteeId: args.menteeId,
          mentorId: args.newMentorId,
          focusArea: null,
          role: "PRIMARY_MENTOR",
          mentorshipId: created.id,
          reason: args.reason,
          actorId: args.actorId,
          startedAt: now,
        },
      });
    }
  });

  return "reassigned";
}

async function repairMentors() {
  console.log("\n=== Mentor assignments ===");

  const resolved = new Map<string, NamedUser>();
  for (const { mentorFirst, menteeFirsts } of MENTOR_TARGETS) {
    const mentor = pickOne(mentorFirst, await resolveByFirstName(mentorFirst));
    if (mentor) resolved.set(mentorFirst, mentor);
    for (const menteeFirst of menteeFirsts) {
      const mentee = pickOne(menteeFirst, await resolveByFirstName(menteeFirst));
      if (mentee) resolved.set(menteeFirst, mentee);
    }
  }

  const desiredPairs: Array<{ mentor: NamedUser; mentee: NamedUser }> = [];
  for (const { mentorFirst, menteeFirsts } of MENTOR_TARGETS) {
    const mentor = resolved.get(mentorFirst);
    if (!mentor) continue;
    for (const menteeFirst of menteeFirsts) {
      const mentee = resolved.get(menteeFirst);
      if (!mentee) continue;
      desiredPairs.push({ mentor, mentee });
    }
  }

  if (desiredPairs.length === 0) {
    console.log("  No resolvable mentor/mentee pairs in this database.");
  }

  const allowedMenteeIdsByMentor = new Map<string, Set<string>>();
  for (const pair of desiredPairs) {
    const set = allowedMenteeIdsByMentor.get(pair.mentor.id) ?? new Set();
    set.add(pair.mentee.id);
    allowedMenteeIdsByMentor.set(pair.mentor.id, set);
  }

  for (const pair of desiredPairs) {
    const current = await prisma.mentorship.findFirst({
      where: { menteeId: pair.mentee.id, status: "ACTIVE", focusArea: null },
      include: { mentor: { select: { id: true, name: true, email: true } } },
      orderBy: { startDate: "desc" },
    });
    const currentLabel = current
      ? `${current.mentor.name} <${current.mentor.email}>`
      : "(none)";
    const needs =
      !current || current.mentorId !== pair.mentor.id
        ? `→ ${pair.mentor.name}`
        : "(already correct)";
    console.log(`  ${pair.mentee.name}: mentor ${currentLabel} ${needs}`);

    if (!APPLY) continue;
    if (current && current.mentorId === pair.mentor.id) continue;

    const status = await reassignMentorCore({
      menteeId: pair.mentee.id,
      newMentorId: pair.mentor.id,
      reason: "Portal label repair: correct primary mentor map.",
      actorId: null,
    });
    console.log(`    applied: ${status}`);
  }

  // Report (and optionally end) stray ACTIVE mentees under Sam/Zach.
  for (const { mentorFirst } of MENTOR_TARGETS) {
    const mentor = resolved.get(mentorFirst);
    if (!mentor) continue;
    const allowed = allowedMenteeIdsByMentor.get(mentor.id) ?? new Set();
    const stray = await prisma.mentorship.findMany({
      where: {
        mentorId: mentor.id,
        status: "ACTIVE",
        menteeId: { notIn: [...allowed] },
      },
      include: { mentee: { select: { id: true, name: true, email: true } } },
    });
    if (stray.length === 0) {
      console.log(`  ${mentor.name}: no stray mentees`);
      continue;
    }
    for (const row of stray) {
      console.log(
        `  ! ${mentor.name} has unexpected mentee ${row.mentee.name} <${row.mentee.email}> (focus=${row.focusArea ?? "null"})`
      );
      if (!APPLY) continue;
      // Only auto-end null-focus primary strays; leave focus-area dual mentors alone.
      if (row.focusArea != null) {
        console.log("    skipped (has focusArea — review manually)");
        continue;
      }
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.mentorship.update({
          where: { id: row.id },
          data: { status: "COMPLETE", endDate: now },
        });
        await tx.mentorshipAssignmentHistory.updateMany({
          where: {
            menteeId: row.menteeId,
            mentorId: mentor.id,
            focusArea: null,
            endedAt: null,
          },
          data: { endedAt: now },
        });
      });
      console.log("    ended stray primary mentorship");
    }
  }
}

async function repairJacksonTitle() {
  console.log("\n=== Titles (Jackson → Director) ===");
  const matches = await resolveByFirstName("Jackson");
  if (matches.length === 0) {
    console.log("  No Jackson found");
    return;
  }
  const jackson = pickOne("Jackson", matches);
  if (!jackson) return;
  const current = await prisma.user.findUnique({
    where: { id: jackson.id },
    select: { canonicalTitle: true, title: true, ladder: true, internalLevel: true },
  });
  const meta = TITLE_AUTHORITY.Director;
  console.log(
    `  ${jackson.name}: canonicalTitle=${current?.canonicalTitle ?? "(null)"} title=${current?.title ?? "(null)"} → Director`
  );
  if (!APPLY) return;
  await prisma.user.update({
    where: { id: jackson.id },
    data: {
      canonicalTitle: meta.title,
      ladder: meta.ladder,
      internalLevel: meta.internalLevel,
      title: meta.title,
    },
  });
  console.log("    applied");
}

async function auditChaptersAndOrg() {
  console.log("\n=== Chapters ===");
  const operating = await ensureOperatingChapters();
  console.log(`  Operating: ${operating.map((c) => `${c.name} (public=${c.isPublic})`).join(", ")}`);
  const { repairs } = await planUserChapterRepairs();
  console.log(`  User chapter repairs needed: ${repairs.length}`);
  for (const row of repairs.slice(0, 25)) {
    console.log(
      `    - ${row.email}: ${row.fromChapter ?? "(none)"} → ${row.toChapter} [${row.reason}]`
    );
  }
  if (repairs.length > 25) console.log(`    …and ${repairs.length - 25} more`);

  console.log("\n=== Function / Department gaps (staff-like) ===");
  const gaps = await prisma.user.findMany({
    where: {
      archivedAt: null,
      primaryRole: { in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR", "MENTOR", "INSTRUCTOR"] },
      OR: [{ orgFunctionId: null }, { orgDepartmentId: null }],
    },
    select: {
      name: true,
      email: true,
      primaryRole: true,
      orgFunctionId: true,
      orgDepartmentId: true,
    },
    orderBy: { name: "asc" },
    take: 40,
  });
  console.log(`  Missing function and/or department: ${gaps.length}${gaps.length === 40 ? "+" : ""}`);
  for (const row of gaps.slice(0, 20)) {
    console.log(
      `    - ${row.name} <${row.email}> (${row.primaryRole}) fn=${row.orgFunctionId ?? "∅"} dept=${row.orgDepartmentId ?? "∅"}`
    );
  }
}

async function main() {
  if (!APPLY) {
    console.log("DRY RUN — re-run with --apply to commit mentor/title changes.\n");
  } else {
    console.log("APPLY MODE — writing mentor/title changes.\n");
  }

  await repairMentors();
  await repairJacksonTitle();
  await auditChaptersAndOrg();

  console.log(
    "\nDone. Chapter user remaps: npm run repair:user-chapters [-- --apply]"
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
