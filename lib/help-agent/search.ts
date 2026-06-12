import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { STRATEGIC_INITIATIVES } from "@/lib/people-strategy/strategic-initiatives";
import { whereActiveMember } from "@/lib/user-role-where";
import type { Entity360Type } from "@/lib/operations/entity-360";

import type { HelpAgentGroup, HelpAgentResult, HelpAgentSearchResponse } from "./types";

/**
 * YPP Help Agent — deterministic, permission-aware entity search.
 *
 * Phase 3C began the SearchDocument cutover: the PERSON group reads the
 * index (title/keywords) when it is populated, and falls back to the live
 * Prisma query when it is empty — the index has no write path yet, so the
 * fallback keeps search correct on environments where the backfill
 * (scripts/backfill-search-documents.ts) has not run. Every other group
 * still runs live, scoped Prisma queries (small `take`s on indexed
 * columns): meetings need date context the index lacks, initiatives are
 * config-defined, and partner/class/action subtitles can go stale without
 * write-path upserts. Remaining cutover work: write-path upserts on entity
 * mutations + a nightly reconcile run of the backfill, then the
 * partner/applicant/action groups.
 *
 * Access mirrors the Entity 360 loaders ("stricter reading wins"):
 *   - person   → any signed-in member (active members only — no applicants)
 *   - partner / class / meeting / action / initiative → officer-tier only
 * Hydration of anything deeper always goes through /api/entity-360, which
 * re-authorizes — a search row can never reveal more than its 360 would.
 */

const PER_GROUP_LIMIT = 6;

const GROUP_LABELS: Record<Entity360Type, string> = {
  person: "People",
  partner: "Partners",
  class: "Classes",
  meeting: "Meetings",
  action: "Actions",
  initiative: "Initiatives",
  mentorship: "Mentorships",
  applicant: "Applicants",
};

/** Quick Find scoring (prefix > word-start > substring), shared convention. */
function scoreLabel(label: string, q: string): number {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 3;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (l.includes(q)) return 1;
  return 0;
}

function rankGroup(items: HelpAgentResult[], q: string): HelpAgentResult[] {
  return items
    .map((item) => ({ item, score: scoreLabel(item.title, q) }))
    .sort(
      (a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)
    )
    .slice(0, PER_GROUP_LIMIT)
    .map((s) => s.item);
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  APPLICANT: "Applicant",
  CHAPTER_PRESIDENT: "Chapter President",
  HIRING_CHAIR: "Hiring Chair",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
  PARENT: "Parent",
  STAFF: "Staff",
  STUDENT: "Student",
};

/**
 * Person search via the SearchDocument index. Returns null when the index
 * has no person rows (backfill never run) so the caller can fall back to
 * the live query — never an empty result set caused by missing ops.
 */
async function searchPeopleFromIndex(q: string): Promise<HelpAgentResult[] | null> {
  const indexed = await prisma.searchDocument
    .count({ where: { entityType: "person" } })
    .catch(() => 0);
  if (indexed === 0) return null;
  const docs = await prisma.searchDocument.findMany({
    where: {
      entityType: "person",
      // Person rows are MEMBER-tier by construction; the explicit filter
      // keeps a future mixed-tier backfill from leaking officer rows here.
      visibilityTier: "MEMBER",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { keywords: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { entityId: true, title: true, subtitle: true },
    orderBy: [{ title: "asc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return docs.map((d) => ({
    type: "person" as const,
    id: d.entityId,
    title: d.title,
    subtitle: d.subtitle ? (ROLE_LABELS[d.subtitle] ?? d.subtitle) : null,
    href: `/people/${d.entityId}`,
  }));
}

async function searchPeople(q: string): Promise<HelpAgentResult[]> {
  const fromIndex = await searchPeopleFromIndex(q).catch(() => null);
  if (fromIndex !== null) return fromIndex;
  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      ...whereActiveMember(),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: [{ name: "asc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return users.map((u) => ({
    type: "person" as const,
    id: u.id,
    title: u.name || u.email,
    subtitle: ROLE_LABELS[u.primaryRole ?? ""] ?? null,
    href: `/people/${u.id}`,
  }));
}

async function searchPartners(q: string): Promise<HelpAgentResult[]> {
  const partners = await prisma.partner.findMany({
    where: {
      archivedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        // Structured contacts (Knowledge OS V2): finding a person you met
        // should surface the organization they belong to.
        { contacts: { some: { name: { contains: q, mode: "insensitive" } } } },
        { contacts: { some: { email: { contains: q, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      partnerType: true,
      contacts: {
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 1,
        select: { name: true },
      },
    },
    orderBy: [{ name: "asc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return partners.map((p) => ({
    type: "partner" as const,
    id: p.id,
    title: p.name,
    subtitle: p.contacts[0]
      ? `Contact: ${p.contacts[0].name}`
      : (p.type ?? p.partnerType ?? null),
    href: `/admin/partners/${p.id}`,
  }));
}

function prettyStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Instructor applications (Knowledge OS V2 Phase 2C) — finding an applicant
 * by name lands on the decision-first Application 360. Officer-tier only,
 * matching the board's read access; active (non-archived) applications only.
 */
async function searchApplications(q: string): Promise<HelpAgentResult[]> {
  const applications = await prisma.instructorApplication.findMany({
    where: {
      archivedAt: null,
      OR: [
        { preferredFirstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { legalName: { contains: q, mode: "insensitive" } },
        { applicant: { name: { contains: q, mode: "insensitive" } } },
        { applicant: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: PER_GROUP_LIMIT * 3,
    select: {
      id: true,
      status: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      applicant: { select: { name: true, email: true } },
    },
  });
  return applications.map((app) => {
    const composed = [app.preferredFirstName, app.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      type: "applicant" as const,
      id: app.id,
      title:
        composed ||
        app.legalName ||
        app.applicant?.name ||
        app.applicant?.email ||
        "Applicant",
      subtitle: prettyStatus(app.status),
      href: `/admin/instructor-applicants/${app.id}`,
    };
  });
}

async function searchClasses(q: string): Promise<HelpAgentResult[]> {
  const offerings = await prisma.classOffering.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { template: { title: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      title: true,
      semester: true,
      status: true,
      template: { select: { title: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return offerings.map((c) => ({
    type: "class" as const,
    id: c.id,
    title: c.title || c.template?.title || "Class offering",
    subtitle: [c.semester, c.status].filter(Boolean).join(" · ") || null,
    href: `/admin/classes/${c.id}`,
  }));
}

async function searchMeetings(q: string): Promise<HelpAgentResult[]> {
  const meetings = await prisma.officerMeeting.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { purpose: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, date: true, category: true },
    orderBy: [{ date: "desc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return meetings.map((m) => ({
    type: "meeting" as const,
    id: m.id,
    title: m.title || "Officer meeting",
    subtitle: [
      m.category,
      m.date ? new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    href: `/actions/meetings/${m.id}`,
  }));
}

async function searchActions(q: string): Promise<HelpAgentResult[]> {
  const actions = await prisma.actionItem.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, status: true },
    orderBy: [{ createdAt: "desc" }],
    take: PER_GROUP_LIMIT * 3,
  });
  return actions.map((a) => ({
    type: "action" as const,
    id: a.id,
    title: a.title,
    subtitle: a.status ? a.status.replaceAll("_", " ").toLowerCase() : null,
    href: `/actions/${a.id}`,
  }));
}

function searchInitiatives(q: string): HelpAgentResult[] {
  return STRATEGIC_INITIATIVES.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      (i.description ?? "").toLowerCase().includes(q)
  ).map((i) => ({
    type: "initiative" as const,
    id: i.id,
    title: i.title,
    subtitle: i.status ?? null,
    href: `/operations/initiatives/${i.id}`,
  }));
}

export async function runHelpAgentSearch(
  rawQuery: string,
  viewer: ActionViewer
): Promise<HelpAgentSearchResponse> {
  const q = rawQuery.trim().toLowerCase();
  const officer = isOfficerTier(viewer);

  if (!q) {
    return { query: rawQuery, groups: [], recents: await loadRecents(viewer) };
  }
  if (q.length < 2) {
    return { query: rawQuery, groups: [], recents: [] };
  }

  const tracker = isActionTrackerEnabled();
  const [people, partners, applications, classes, meetings, actions] =
    await Promise.all([
      searchPeople(q),
      officer ? searchPartners(q) : Promise.resolve([]),
      officer ? searchApplications(q) : Promise.resolve([]),
      officer ? searchClasses(q) : Promise.resolve([]),
      officer && tracker ? searchMeetings(q) : Promise.resolve([]),
      officer && tracker ? searchActions(q) : Promise.resolve([]),
    ]);
  const initiatives = officer && tracker ? searchInitiatives(q) : [];

  const groups: HelpAgentGroup[] = (
    [
      ["person", people],
      ["applicant", applications],
      ["partner", partners],
      ["class", classes],
      ["meeting", meetings],
      ["action", actions],
      ["initiative", initiatives],
    ] as Array<[Entity360Type, HelpAgentResult[]]>
  )
    .map(([type, items]) => ({
      type,
      label: GROUP_LABELS[type],
      items: rankGroup(items, q),
    }))
    .filter((g) => g.items.length > 0);

  return { query: rawQuery, groups, recents: [] };
}

/**
 * Recently viewed entities for the empty-query state — written by the
 * Entity 360 API on every drawer open, hydrated live so titles never go
 * stale, re-filtered to the viewer's current tier.
 */
async function loadRecents(viewer: ActionViewer): Promise<HelpAgentResult[]> {
  const officer = isOfficerTier(viewer);
  const rows = await prisma.recentEntityView.findMany({
    where: { userId: viewer.id },
    orderBy: { viewedAt: "desc" },
    take: 12,
  });
  if (rows.length === 0) return [];

  const allowedTypes = new Set<string>(
    officer
      ? ["person", "partner", "class", "meeting", "action", "initiative"]
      : ["person"]
  );

  const results: HelpAgentResult[] = [];
  for (const row of rows) {
    if (results.length >= 8) break;
    if (!allowedTypes.has(row.entityType)) continue;
    const hydrated = await hydrateRecent(row.entityType, row.entityId);
    if (hydrated) results.push(hydrated);
  }
  return results;
}

async function hydrateRecent(
  entityType: string,
  entityId: string
): Promise<HelpAgentResult | null> {
  switch (entityType) {
    case "person": {
      const u = await prisma.user.findUnique({
        where: { id: entityId },
        select: { id: true, name: true, email: true, primaryRole: true, archivedAt: true },
      });
      if (!u || u.archivedAt) return null;
      return {
        type: "person",
        id: u.id,
        title: u.name || u.email,
        subtitle: ROLE_LABELS[u.primaryRole ?? ""] ?? null,
        href: `/people/${u.id}`,
      };
    }
    case "partner": {
      const p = await prisma.partner.findUnique({
        where: { id: entityId },
        select: { id: true, name: true, type: true, archivedAt: true },
      });
      if (!p || p.archivedAt) return null;
      return { type: "partner", id: p.id, title: p.name, subtitle: p.type, href: `/admin/partners/${p.id}` };
    }
    case "class": {
      const c = await prisma.classOffering.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, semester: true, template: { select: { title: true } } },
      });
      if (!c) return null;
      return {
        type: "class",
        id: c.id,
        title: c.title || c.template?.title || "Class offering",
        subtitle: c.semester,
        href: `/admin/classes/${c.id}`,
      };
    }
    case "meeting": {
      const m = await prisma.officerMeeting.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, category: true },
      });
      if (!m) return null;
      return { type: "meeting", id: m.id, title: m.title || "Officer meeting", subtitle: m.category, href: `/actions/meetings/${m.id}` };
    }
    case "action": {
      const a = await prisma.actionItem.findUnique({
        where: { id: entityId },
        select: { id: true, title: true },
      });
      if (!a) return null;
      return { type: "action", id: a.id, title: a.title, subtitle: null, href: `/actions/${a.id}` };
    }
    case "initiative": {
      const i = STRATEGIC_INITIATIVES.find((x) => x.id === entityId);
      if (!i) return null;
      return { type: "initiative", id: i.id, title: i.title, subtitle: null, href: `/operations/initiatives/${i.id}` };
    }
    default:
      return null;
  }
}
