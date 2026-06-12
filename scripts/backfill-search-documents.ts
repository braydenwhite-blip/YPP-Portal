/**
 * YPP Help Agent — SearchDocument backfill / reconcile.
 *
 * Populates the deterministic search index from the live entity tables
 * (people, partners, classes, meetings, actions). Re-runnable: upserts by
 * (entityType, entityId) and deletes index rows whose source row is gone.
 *
 * The V1 /api/search route queries the entity tables live, so running this
 * is OPTIONAL today — the index exists so the next pass can cut the API over
 * to it (with pg_trgm fuzziness) without a schema change. Initiatives are a
 * config registry (lib/people-strategy/strategic-initiatives.ts) and are
 * served from memory, so they are not indexed here.
 *
 * Usage: npx tsx scripts/backfill-search-documents.ts
 */

import { prisma } from "../lib/prisma";
import { whereActiveMember } from "../lib/user-role-where";

type IndexRow = {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
  visibilityTier: "MEMBER" | "OFFICER";
};

async function collectRows(): Promise<IndexRow[]> {
  const rows: IndexRow[] = [];

  const users = await prisma.user.findMany({
    where: { archivedAt: null, ...whereActiveMember() },
    select: { id: true, name: true, email: true, primaryRole: true },
  });
  for (const u of users) {
    rows.push({
      entityType: "person",
      entityId: u.id,
      title: u.name || u.email,
      subtitle: u.primaryRole ?? null,
      keywords: u.email,
      visibilityTier: "MEMBER",
    });
  }

  const partners = await prisma.partner.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      partnerType: true,
      contactName: true,
      // Structured contacts index as keywords so "find the person I met"
      // surfaces their organization (Knowledge OS V2, plan §24).
      contacts: { select: { name: true, email: true } },
    },
  });
  for (const p of partners) {
    rows.push({
      entityType: "partner",
      entityId: p.id,
      title: p.name,
      subtitle: p.type ?? p.partnerType ?? null,
      keywords:
        [
          p.partnerType,
          p.contactName,
          ...p.contacts.flatMap((c) => [c.name, c.email]),
        ]
          .filter(Boolean)
          .join(" ") || null,
      visibilityTier: "OFFICER",
    });
  }

  const offerings = await prisma.classOffering.findMany({
    select: {
      id: true,
      title: true,
      semester: true,
      template: { select: { title: true } },
    },
  });
  for (const c of offerings) {
    rows.push({
      entityType: "class",
      entityId: c.id,
      title: c.title || c.template?.title || "Class offering",
      subtitle: c.semester,
      keywords: c.template?.title ?? null,
      visibilityTier: "OFFICER",
    });
  }

  const meetings = await prisma.officerMeeting.findMany({
    select: { id: true, title: true, purpose: true, category: true },
  });
  for (const m of meetings) {
    rows.push({
      entityType: "meeting",
      entityId: m.id,
      title: m.title || "Officer meeting",
      subtitle: m.category,
      keywords: m.purpose,
      visibilityTier: "OFFICER",
    });
  }

  const actions = await prisma.actionItem.findMany({
    select: { id: true, title: true, status: true },
  });
  for (const a of actions) {
    rows.push({
      entityType: "action",
      entityId: a.id,
      title: a.title,
      subtitle: a.status,
      keywords: null,
      visibilityTier: "OFFICER",
    });
  }

  return rows;
}

async function main() {
  const rows = await collectRows();
  console.log(`Collected ${rows.length} index rows. Upserting…`);

  let upserted = 0;
  for (const row of rows) {
    await prisma.searchDocument.upsert({
      where: {
        entityType_entityId: {
          entityType: row.entityType,
          entityId: row.entityId,
        },
      },
      create: row,
      update: {
        title: row.title,
        subtitle: row.subtitle,
        keywords: row.keywords,
        visibilityTier: row.visibilityTier,
      },
    });
    upserted += 1;
    if (upserted % 250 === 0) console.log(`  …${upserted}/${rows.length}`);
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

  console.log(
    `Done: ${upserted} upserted, ${staleIds.length} stale rows removed.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
