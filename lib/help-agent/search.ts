import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { instructorApplicationVisibilityWhere } from "@/lib/applications/application-visibility";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";
import { isOfficerTier, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { STRATEGIC_INITIATIVES } from "@/lib/people-strategy/strategic-initiatives";
import { whereActiveMember } from "@/lib/user-role-where";
import type { Entity360Type } from "@/lib/operations/entity-360";

import type { HelpAgentGroup, HelpAgentResult, HelpAgentSearchResponse } from "./types";

/**
 * YPP Help Agent — deterministic, permission-aware entity search.
 *
 * SearchDocument cutover status (Phase 3C started it, 3D/3E/3F extended it):
 * the PERSON, PARTNER, APPLICANT, ACTION, and MEETING groups read the index
 * (title/keywords, kept current by the write-path upserts in
 * lib/help-agent/search-indexing.ts and the nightly
 * /api/cron/search-reconcile), and every group falls back to its live
 * Prisma query when the index is empty, has no text hits, or errors —
 * search stays correct on environments where the backfill has never run.
 * Applicant index hits are additionally re-checked against the live
 * per-viewer application visibility filter, so the index can never widen
 * access. The meeting group sorts off the indexed `eventAt` (date desc) to
 * match its live ordering. Classes stay live (no write-path sync yet), and
 * initiatives are config-defined.
 *
 * Access mirrors the Entity 360 loaders ("stricter reading wins"):
 *   - person   → any signed-in member (active members only — no applicants)
 *   - partner / class / meeting / action / initiative → officer-tier only
 *   - applicant → officer-tier, narrowed per viewer (chapter / assignment)
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

function canOpenAdminRecord(viewer: ActionViewer): boolean {
  return viewer.primaryRole === "ADMIN" || viewer.roles.includes("ADMIN");
}

type SearchIndexHit = {
  entityId: string;
  title: string;
  subtitle: string | null;
};

/**
 * Read one entity group from the SearchDocument index. Returns null when
 * the group has no index rows (backfill never run) or the query has no
 * text hits, so the caller falls back to its live query — never an empty
 * result set caused by missing ops.
 */
async function searchIndexGroup(
  entityType: string,
  visibilityTier: "MEMBER" | "OFFICER",
  q: string,
  options: { orderBy?: "title" | "eventAtDesc" } = {}
): Promise<SearchIndexHit[] | null> {
  const groupWhere = { entityType, visibilityTier };
  const indexed = await prisma.searchDocument
    .count({ where: groupWhere })
    .catch(() => 0);
  if (indexed === 0) return null;
  // Time-anchored groups (meetings) sort newest-first off `eventAt`, mirroring
  // the live query's `date desc`; everything else sorts alphabetically. Rows
  // with a null `eventAt` fall to the bottom (Prisma default for desc).
  const orderBy =
    options.orderBy === "eventAtDesc"
      ? [{ eventAt: "desc" as const }, { title: "asc" as const }]
      : [{ title: "asc" as const }];
  const docs = await prisma.searchDocument.findMany({
    where: {
      ...groupWhere,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { keywords: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { entityId: true, title: true, subtitle: true },
    orderBy,
    take: PER_GROUP_LIMIT * 3,
  });
  if (docs.length === 0) return null;
  return docs;
}

async function searchPeopleFromIndex(q: string): Promise<HelpAgentResult[] | null> {
  const docs = await searchIndexGroup("person", "MEMBER", q);
  if (docs === null) return null;
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

async function searchPartnersFromIndex(
  q: string,
  viewer: ActionViewer
): Promise<HelpAgentResult[] | null> {
  const docs = await searchIndexGroup("partner", "OFFICER", q);
  if (docs === null) return null;
  const adminRecordAccess = canOpenAdminRecord(viewer);
  return docs.map((d) => ({
    type: "partner" as const,
    id: d.entityId,
    title: d.title,
    subtitle: d.subtitle,
    href: adminRecordAccess ? `/admin/partners/${d.entityId}` : null,
  }));
}

async function searchPartners(
  q: string,
  viewer: ActionViewer
): Promise<HelpAgentResult[]> {
  const fromIndex = await searchPartnersFromIndex(q, viewer).catch(() => null);
  if (fromIndex !== null) return fromIndex;
  const adminRecordAccess = canOpenAdminRecord(viewer);
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
    href: adminRecordAccess ? `/admin/partners/${p.id}` : null,
  }));
}

function prettyStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Applicant index path: text-match on the index, then re-check every hit
 * against the live per-viewer visibility filter (chapter / assignment /
 * own application) so an OFFICER-tier index row can never widen access.
 */
async function searchApplicationsFromIndex(
  q: string,
  visibilityWhere: NonNullable<
    Awaited<ReturnType<typeof instructorApplicationVisibilityWhere>>
  >
): Promise<HelpAgentResult[] | null> {
  const docs = await searchIndexGroup("applicant", "OFFICER", q);
  if (docs === null) return null;
  const visible = await prisma.instructorApplication.findMany({
    where: {
      AND: [
        { id: { in: docs.map((d) => d.entityId) } },
        { archivedAt: null },
        visibilityWhere,
      ],
    },
    select: { id: true },
  });
  const visibleIds = new Set(visible.map((v) => v.id));
  return docs
    .filter((d) => visibleIds.has(d.entityId))
    .map((d) => ({
      type: "applicant" as const,
      id: d.entityId,
      title: d.title,
      subtitle: d.subtitle ? prettyStatus(d.subtitle) : null,
      href: `/admin/instructor-applicants/${d.entityId}`,
    }));
}

/**
 * Instructor applications (Knowledge OS V2 Phase 2C) — finding an applicant
 * by name lands on the decision-first Application 360. Officer-tier only,
 * matching the board's read access; active (non-archived) applications only.
 */
async function searchApplications(
  q: string,
  viewer: ActionViewer
): Promise<HelpAgentResult[]> {
  const visibilityWhere = await instructorApplicationVisibilityWhere(viewer.id);
  if (!visibilityWhere) return [];

  const fromIndex = await searchApplicationsFromIndex(q, visibilityWhere).catch(
    () => null
  );
  if (fromIndex !== null) return fromIndex;

  const applications = await prisma.instructorApplication.findMany({
    where: {
      AND: [
        { archivedAt: null },
        visibilityWhere,
        {
          OR: [
            { preferredFirstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { legalName: { contains: q, mode: "insensitive" } },
            { applicant: { name: { contains: q, mode: "insensitive" } } },
            { applicant: { email: { contains: q, mode: "insensitive" } } },
          ],
        },
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

async function searchClasses(
  q: string,
  viewer: ActionViewer
): Promise<HelpAgentResult[]> {
  const adminRecordAccess = canOpenAdminRecord(viewer);
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
    href: adminRecordAccess ? `/admin/classes/${c.id}` : null,
  }));
}

/**
 * Meeting index path (Phase 3F cutover): meeting rows now carry `eventAt`
 * (the start date) and a `category · date` subtitle (Phase 3E write path),
 * so the group reads the index — ordered newest-first off `eventAt` to
 * match the live `date desc`. Officer-tier, like the live query; standard
 * three-way fallback (empty group / no text hit / index error → live).
 */
async function searchMeetingsFromIndex(q: string): Promise<HelpAgentResult[] | null> {
  const docs = await searchIndexGroup("meeting", "OFFICER", q, {
    orderBy: "eventAtDesc",
  });
  if (docs === null) return null;
  return docs.map((d) => ({
    type: "meeting" as const,
    id: d.entityId,
    title: d.title,
    subtitle: d.subtitle,
    href: `/meetings/${d.entityId}`,
  }));
}

async function searchMeetings(q: string): Promise<HelpAgentResult[]> {
  const fromIndex = await searchMeetingsFromIndex(q).catch(() => null);
  if (fromIndex !== null) return fromIndex;
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
    href: `/meetings/${m.id}`,
  }));
}

/**
 * Action index path (Phase 3E cutover): the write-path upserts (create /
 * update / status / capture) keep action rows current, so the group reads
 * the index — richer subtitles (status · owner · due) and the owner /
 * source-meeting keywords the live title-only query can't match. Access
 * semantics are unchanged: the group is officer-tier (same as the live
 * query), and `/actions/[id]` re-checks `canViewAction` on open.
 */
async function searchActionsFromIndex(q: string): Promise<HelpAgentResult[] | null> {
  const docs = await searchIndexGroup("action", "OFFICER", q);
  if (docs === null) return null;
  return docs.map((d) => ({
    type: "action" as const,
    id: d.entityId,
    title: d.title,
    subtitle: d.subtitle,
    href: `/actions/${d.entityId}`,
  }));
}

async function searchActions(q: string): Promise<HelpAgentResult[]> {
  const fromIndex = await searchActionsFromIndex(q).catch(() => null);
  if (fromIndex !== null) return fromIndex;
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

/**
 * The Mentorship relationship a search hit may NOT reveal to an unauthorized
 * viewer. Authorization mirrors `hasMentorshipMenteeAccess`:
 *   - ADMIN → every relationship
 *   - CHAPTER_PRESIDENT → relationships for their chapter's mentees
 *   - mentor / chair → the relationships they run
 *   - the mentee → their own relationship
 * Everyone else gets nothing. The href is role-appropriate so an admin URL is
 * never handed to a non-admin.
 */
const MENTORSHIP_RESULT_SELECT = {
  id: true,
  type: true,
  status: true,
  menteeId: true,
  mentorId: true,
  chairId: true,
  mentor: { select: { name: true, email: true } },
  mentee: { select: { name: true, email: true } },
} as const;

type MentorshipResultRow = {
  id: string;
  type: string | null;
  status: string;
  menteeId: string;
  mentorId: string | null;
  chairId: string | null;
  mentor: { name: string | null; email: string } | null;
  mentee: { name: string | null; email: string } | null;
};

/** The where-clause that scopes Mentorship rows to what `viewer` may see. */
function mentorshipAuthorizationWhere(
  viewer: ActionViewer,
  accessibleMenteeIds: string[] | null
): Prisma.MentorshipWhereInput {
  if (accessibleMenteeIds === null) return {}; // ADMIN — all relationships
  return {
    OR: [
      { mentorId: viewer.id },
      { chairId: viewer.id },
      { menteeId: viewer.id },
      ...(accessibleMenteeIds.length > 0
        ? [{ menteeId: { in: accessibleMenteeIds } }]
        : []),
    ],
  };
}

function mentorshipResultHref(viewer: ActionViewer, row: MentorshipResultRow): string {
  if (canOpenAdminRecord(viewer)) return `/admin/mentorship/relationships/${row.id}`;
  if (row.menteeId === viewer.id) return "/my-mentor";
  return `/mentorship/mentees/${row.menteeId}`;
}

function mentorshipResult(viewer: ActionViewer, row: MentorshipResultRow): HelpAgentResult {
  const mentorName = row.mentor?.name ?? row.mentor?.email ?? "Unassigned";
  const menteeName = row.mentee?.name ?? row.mentee?.email ?? "Unassigned";
  return {
    type: "mentorship",
    id: row.id,
    title: `${mentorName} → ${menteeName}`,
    subtitle:
      [row.type ? prettyStatus(row.type) : null, prettyStatus(row.status)]
        .filter(Boolean)
        .join(" · ") || null,
    href: mentorshipResultHref(viewer, row),
  };
}

/**
 * Mentorship relationships (Unification Phase 5E). Privacy-sensitive: the index
 * hit is only a candidate — every result is re-checked against the live
 * per-viewer membership filter (like applicants), so the OFFICER-tier index can
 * never widen access. Runs for every viewer, since an assigned mentor or a
 * mentee may be a plain member.
 */
async function searchMentorships(q: string, viewer: ActionViewer): Promise<HelpAgentResult[]> {
  const accessibleMenteeIds = await getMentorshipAccessibleMenteeIds(viewer.id, viewer.roles);
  const authWhere = mentorshipAuthorizationWhere(viewer, accessibleMenteeIds);

  // Index path: text-match the index, then authorize the hits against the DB.
  const docs = await searchIndexGroup("mentorship", "OFFICER", q).catch(() => null);
  if (docs !== null) {
    const authorized = await prisma.mentorship.findMany({
      where: { AND: [{ id: { in: docs.map((d) => d.entityId) } }, authWhere] },
      select: MENTORSHIP_RESULT_SELECT,
    });
    return authorized.map((row) => mentorshipResult(viewer, row));
  }

  // Live fallback (index never backfilled): authorize and text-match together.
  const where: Prisma.MentorshipWhereInput = {
    AND: [
      authWhere,
      { status: { in: ["ACTIVE", "PAUSED"] } },
      {
        OR: [
          { mentor: { name: { contains: q, mode: "insensitive" } } },
          { mentor: { email: { contains: q, mode: "insensitive" } } },
          { mentee: { name: { contains: q, mode: "insensitive" } } },
          { mentee: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
    ],
  };
  const rows = await prisma.mentorship.findMany({
    where,
    select: MENTORSHIP_RESULT_SELECT,
    take: PER_GROUP_LIMIT * 3,
  });
  return rows.map((row) => mentorshipResult(viewer, row));
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
  const [people, partners, applications, classes, meetings, actions, mentorships] =
    await Promise.all([
      searchPeople(q),
      officer ? searchPartners(q, viewer) : Promise.resolve([]),
      officer ? searchApplications(q, viewer) : Promise.resolve([]),
      officer ? searchClasses(q, viewer) : Promise.resolve([]),
      officer && tracker ? searchMeetings(q) : Promise.resolve([]),
      officer && tracker ? searchActions(q) : Promise.resolve([]),
      // Runs for every viewer — an assigned mentor or the mentee may be a plain
      // member; the per-relationship membership re-check is the access gate.
      searchMentorships(q, viewer),
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
      ["mentorship", mentorships],
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
    const hydrated = await hydrateRecent(row.entityType, row.entityId, viewer);
    if (hydrated) results.push(hydrated);
  }
  return results;
}

async function hydrateRecent(
  entityType: string,
  entityId: string,
  viewer: ActionViewer
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
      return {
        type: "partner",
        id: p.id,
        title: p.name,
        subtitle: p.type,
        href: canOpenAdminRecord(viewer) ? `/admin/partners/${p.id}` : null,
      };
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
        href: canOpenAdminRecord(viewer) ? `/admin/classes/${c.id}` : null,
      };
    }
    case "meeting": {
      const m = await prisma.officerMeeting.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, category: true },
      });
      if (!m) return null;
      return { type: "meeting", id: m.id, title: m.title || "Officer meeting", subtitle: m.category, href: `/meetings/${m.id}` };
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
