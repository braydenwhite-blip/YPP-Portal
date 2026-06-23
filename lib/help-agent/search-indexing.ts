import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { whereActiveMember } from "@/lib/user-role-where";

/**
 * YPP Help Agent — SearchDocument write path (Knowledge OS V2 Phase 3D).
 *
 * One module owns how every searchable entity becomes an index row: the
 * builders here are the single vocabulary shared by the write-path sync
 * helpers (called from server actions after a mutation), the reconcile
 * (scripts/backfill-search-documents.ts + the nightly cron), and therefore
 * the read path in lib/help-agent/search.ts.
 *
 * Rules:
 * - Indexing NEVER fails the mutation that triggered it. Every sync helper
 *   catches, logs, and returns — the nightly reconcile self-heals misses.
 * - Only fields the search UI shows are indexed (title, a short subtitle,
 *   match keywords). No notes, scores, or private fields.
 * - `visibilityTier` mirrors the read-path access rules: person rows are
 *   MEMBER (any signed-in user can search people), everything else is
 *   OFFICER. Applicant rows additionally get re-checked against the live
 *   per-viewer application visibility filter at query time — the tier is a
 *   ceiling, never the whole story.
 */

export type SearchDocumentRow = {
  entityType: "person" | "partner" | "applicant" | "class" | "action" | "mentorship";
  entityId: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
  visibilityTier: "MEMBER" | "OFFICER";
  /** Event time for time-anchored entities (a meeting's start). */
  eventAt?: Date | null;
};

function joinKeywords(parts: Array<string | null | undefined>): string | null {
  const joined = parts.filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/* ------------------------------------------------------------------ */
/* Document builders — deterministic entity → row mapping              */
/* ------------------------------------------------------------------ */

export function buildPersonDocument(user: {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
}): SearchDocumentRow {
  return {
    entityType: "person",
    entityId: user.id,
    title: user.name || user.email,
    subtitle: user.primaryRole ?? null,
    keywords: user.email,
    visibilityTier: "MEMBER",
  };
}

export function buildPartnerDocument(partner: {
  id: string;
  name: string;
  type: string | null;
  partnerType: string | null;
  contactName: string | null;
  relationshipLead?: { name: string | null } | null;
  contacts: Array<{ name: string | null; email: string | null }>;
}): SearchDocumentRow {
  return {
    entityType: "partner",
    entityId: partner.id,
    title: partner.name,
    subtitle: partner.type ?? partner.partnerType ?? null,
    keywords: joinKeywords([
      partner.partnerType,
      partner.contactName,
      partner.relationshipLead?.name,
      ...partner.contacts.flatMap((c) => [c.name, c.email]),
    ]),
    visibilityTier: "OFFICER",
  };
}

export function buildApplicationDocument(app: {
  id: string;
  status: string;
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  applicant: { name: string | null; email: string | null } | null;
}): SearchDocumentRow {
  const composed = [app.preferredFirstName, app.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    entityType: "applicant",
    entityId: app.id,
    title:
      composed || app.legalName || app.applicant?.name || app.applicant?.email || "Applicant",
    subtitle: app.status,
    keywords: joinKeywords([app.legalName, app.applicant?.name, app.applicant?.email]),
    visibilityTier: "OFFICER",
  };
}

function prettyStatusWord(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export function buildActionDocument(action: {
  id: string;
  title: string;
  status: string | null;
  deadlineStart?: Date | null;
  deadlineEnd?: Date | null;
  lead?: { name: string | null; email: string | null } | null;
}): SearchDocumentRow {
  const owner = action.lead?.name ?? action.lead?.email ?? null;
  const deadline = action.deadlineEnd ?? action.deadlineStart ?? null;
  return {
    entityType: "action",
    entityId: action.id,
    title: action.title,
    // Owner / status / due context so a search hit reads like a work row.
    subtitle:
      [
        action.status ? prettyStatusWord(action.status) : null,
        owner,
        deadline
          ? `Due ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    // Match terms: the owner.
    keywords: joinKeywords([
      action.lead?.name,
      action.lead?.email,
    ]),
    visibilityTier: "OFFICER",
  };
}

export function buildMentorshipDocument(mentorship: {
  id: string;
  type: string | null;
  status: string;
  mentor: { name: string | null; email: string } | null;
  mentee: { name: string | null; email: string } | null;
}): SearchDocumentRow {
  const mentorName = mentorship.mentor?.name ?? mentorship.mentor?.email ?? "Unassigned";
  const menteeName = mentorship.mentee?.name ?? mentorship.mentee?.email ?? "Unassigned";
  return {
    entityType: "mentorship",
    entityId: mentorship.id,
    // "Mentor → Mentee" reads as the relationship in one glance.
    title: `${mentorName} → ${menteeName}`,
    subtitle:
      [mentorship.type ? prettyStatusWord(mentorship.type) : null, prettyStatusWord(mentorship.status)]
        .filter(Boolean)
        .join(" · ") || null,
    // Match either party by name or email so "find Maya's mentorship" works.
    keywords: joinKeywords([
      mentorship.mentor?.name,
      mentorship.mentor?.email,
      mentorship.mentee?.name,
      mentorship.mentee?.email,
    ]),
    // OFFICER ceiling: the read path additionally re-checks every hit against
    // the live per-relationship membership filter (mentor / mentee / chair /
    // admin), so this row never reveals a pairing to an unauthorized viewer.
    visibilityTier: "OFFICER",
  };
}

export function buildClassDocument(offering: {
  id: string;
  title: string | null;
  semester: string | null;
  template: { title: string | null } | null;
}): SearchDocumentRow {
  return {
    entityType: "class",
    entityId: offering.id,
    title: offering.title || offering.template?.title || "Class offering",
    subtitle: offering.semester,
    keywords: offering.template?.title ?? null,
    visibilityTier: "OFFICER",
  };
}

/* ------------------------------------------------------------------ */
/* Upsert / remove primitives                                          */
/* ------------------------------------------------------------------ */

export async function upsertSearchDocument(row: SearchDocumentRow): Promise<void> {
  await prisma.searchDocument.upsert({
    where: {
      entityType_entityId: { entityType: row.entityType, entityId: row.entityId },
    },
    create: { ...row, eventAt: row.eventAt ?? null },
    update: {
      title: row.title,
      subtitle: row.subtitle,
      keywords: row.keywords,
      visibilityTier: row.visibilityTier,
      eventAt: row.eventAt ?? null,
    },
  });
}

export async function removeSearchDocument(
  entityType: SearchDocumentRow["entityType"],
  entityId: string
): Promise<void> {
  await prisma.searchDocument.deleteMany({ where: { entityType, entityId } });
}

function logIndexError(entityType: string, entityId: string, err: unknown) {
  logger.warn(
    { err, entityType, entityId },
    "search-index sync failed (mutation unaffected; nightly reconcile self-heals)"
  );
}

/* ------------------------------------------------------------------ */
/* Write-path sync helpers — call after a mutation commits.            */
/* Each one re-reads the entity so it indexes committed state, upserts */
/* when the entity still qualifies, and removes the row when it no     */
/* longer does (archived / deleted). Never throws.                     */
/* ------------------------------------------------------------------ */

export async function syncPersonSearchDocument(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, archivedAt: null, ...whereActiveMember() },
      select: { id: true, name: true, email: true, primaryRole: true },
    });
    if (!user) {
      await removeSearchDocument("person", userId);
      return;
    }
    await upsertSearchDocument(buildPersonDocument(user));
  } catch (err) {
    logIndexError("person", userId, err);
  }
}

export async function syncPartnerSearchDocument(partnerId: string): Promise<void> {
  try {
    const partner = await prisma.partner.findFirst({
      where: { id: partnerId, archivedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        partnerType: true,
        contactName: true,
        relationshipLead: { select: { name: true } },
        contacts: { select: { name: true, email: true } },
      },
    });
    if (!partner) {
      await removeSearchDocument("partner", partnerId);
      return;
    }
    await upsertSearchDocument(buildPartnerDocument(partner));
  } catch (err) {
    logIndexError("partner", partnerId, err);
  }
}

export async function syncApplicationSearchDocument(applicationId: string): Promise<void> {
  try {
    const app = await prisma.instructorApplication.findFirst({
      where: { id: applicationId, archivedAt: null },
      select: {
        id: true,
        status: true,
        preferredFirstName: true,
        lastName: true,
        legalName: true,
        applicant: { select: { name: true, email: true } },
      },
    });
    if (!app) {
      await removeSearchDocument("applicant", applicationId);
      return;
    }
    await upsertSearchDocument(buildApplicationDocument(app));
  } catch (err) {
    logIndexError("applicant", applicationId, err);
  }
}

export async function syncActionSearchDocument(actionId: string): Promise<void> {
  try {
    const action = await prisma.actionItem.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        title: true,
        status: true,
        deadlineStart: true,
        deadlineEnd: true,
        lead: { select: { name: true, email: true } },
      },
    });
    if (!action) {
      await removeSearchDocument("action", actionId);
      return;
    }
    await upsertSearchDocument(buildActionDocument(action));
  } catch (err) {
    logIndexError("action", actionId, err);
  }
}

/**
 * Mentorship relationships are indexed while they are live (ACTIVE / PAUSED);
 * a completed pairing drops out so search stays about current relationships.
 */
const MENTORSHIP_INDEXABLE_STATUSES = ["ACTIVE", "PAUSED"] as const;

const MENTORSHIP_DOCUMENT_SELECT = {
  id: true,
  type: true,
  status: true,
  mentor: { select: { name: true, email: true } },
  mentee: { select: { name: true, email: true } },
} as const;

export async function syncMentorshipSearchDocument(mentorshipId: string): Promise<void> {
  try {
    const mentorship = await prisma.mentorship.findFirst({
      where: { id: mentorshipId, status: { in: [...MENTORSHIP_INDEXABLE_STATUSES] } },
      select: MENTORSHIP_DOCUMENT_SELECT,
    });
    if (!mentorship) {
      await removeSearchDocument("mentorship", mentorshipId);
      return;
    }
    await upsertSearchDocument(buildMentorshipDocument(mentorship));
  } catch (err) {
    logIndexError("mentorship", mentorshipId, err);
  }
}

/* ------------------------------------------------------------------ */
/* Reconcile — idempotent full rebuild, shared by the backfill script  */
/* and the nightly cron. Upserts every qualifying entity and deletes   */
/* index rows whose source no longer qualifies.                        */
/* ------------------------------------------------------------------ */

export type SearchReconcileReport = {
  upsertedByType: Record<string, number>;
  staleRemoved: number;
  total: number;
};

async function collectAllRows(): Promise<SearchDocumentRow[]> {
  const rows: SearchDocumentRow[] = [];

  const users = await prisma.user.findMany({
    where: { archivedAt: null, ...whereActiveMember() },
    select: { id: true, name: true, email: true, primaryRole: true },
  });
  for (const u of users) rows.push(buildPersonDocument(u));

  const partners = await prisma.partner.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      partnerType: true,
      contactName: true,
      relationshipLead: { select: { name: true } },
      contacts: { select: { name: true, email: true } },
    },
  });
  for (const p of partners) rows.push(buildPartnerDocument(p));

  const applications = await prisma.instructorApplication.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      status: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      applicant: { select: { name: true, email: true } },
    },
  });
  for (const app of applications) rows.push(buildApplicationDocument(app));

  const offerings = await prisma.classOffering.findMany({
    select: {
      id: true,
      title: true,
      semester: true,
      template: { select: { title: true } },
    },
  });
  for (const c of offerings) rows.push(buildClassDocument(c));

  const actions = await prisma.actionItem.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      deadlineStart: true,
      deadlineEnd: true,
      lead: { select: { name: true, email: true } },
    },
  });
  for (const a of actions) rows.push(buildActionDocument(a));

  // Mentorship relationships (Unification Phase 5E). Canonical mentorship next
  // steps already index as `action` rows, so only the relationship itself is a
  // new document — no per-action duplication.
  const mentorships = await prisma.mentorship.findMany({
    where: { status: { in: [...MENTORSHIP_INDEXABLE_STATUSES] } },
    select: MENTORSHIP_DOCUMENT_SELECT,
  });
  for (const m of mentorships) rows.push(buildMentorshipDocument(m));

  return rows;
}

export async function reconcileSearchDocuments(
  options: { log?: (message: string) => void } = {}
): Promise<SearchReconcileReport> {
  const log = options.log ?? (() => {});
  const rows = await collectAllRows();
  log(`Collected ${rows.length} index rows. Upserting…`);

  const upsertedByType: Record<string, number> = {};
  let upserted = 0;
  for (const row of rows) {
    await upsertSearchDocument(row);
    upsertedByType[row.entityType] = (upsertedByType[row.entityType] ?? 0) + 1;
    upserted += 1;
    if (upserted % 250 === 0) log(`  …${upserted}/${rows.length}`);
  }

  // Reconcile: drop index rows whose source entity no longer qualifies.
  const live = new Set(rows.map((r) => `${r.entityType}:${r.entityId}`));
  const indexed = await prisma.searchDocument.findMany({
    select: { id: true, entityType: true, entityId: true },
  });
  const staleIds = indexed
    .filter((d) => !live.has(`${d.entityType}:${d.entityId}`))
    .map((d) => d.id);
  if (staleIds.length > 0) {
    await prisma.searchDocument.deleteMany({ where: { id: { in: staleIds } } });
  }

  log(`Done: ${upserted} upserted, ${staleIds.length} stale rows removed.`);
  return { upsertedByType, staleRemoved: staleIds.length, total: upserted };
}
