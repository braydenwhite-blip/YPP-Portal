import Link from "next/link";
import { notFound } from "next/navigation";

import { requireJourneyEditor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

import { JourneyEditorShell } from "./journey-editor-shell";

export const dynamic = "force-dynamic";

export default async function AdminJourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const editor = await requireJourneyEditor();
  const { id } = await params;

  const journey = await prisma.journey.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { _count: { select: { beats: true, gates: true } } },
      },
      assignmentRules: { select: { audience: true, autoEnroll: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, action: true, actorId: true, createdAt: true },
      },
    },
  });

  if (!journey) notFound();

  const draft = journey.versions.find((v) => v.status === "DRAFT");
  const draftGates = draft
    ? await prisma.journeyGate.findMany({
        where: { journeyVersionId: draft.id },
        select: { id: true, kind: true, targetRef: true, requiredRef: true, threshold: true },
      })
    : [];
  const knownModules = await prisma.trainingModule.findMany({
    where: { contentKey: { not: null }, archivedAt: null },
    select: { contentKey: true },
  });
  const knownModuleRefs = knownModules
    .map((m) => m.contentKey)
    .filter((k): k is string => Boolean(k))
    .map((k) => `module:${k}`);
  const draftBeats = draft
    ? await prisma.interactiveBeat.findMany({
        where: { journeyVersionId: draft.id, removedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sourceKey: true,
          kind: true,
          title: true,
          prompt: true,
          sortOrder: true,
          scoringWeight: true,
          config: true,
        },
      })
    : [];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link className="link-back" href="/admin/journeys">
            ← All journeys
          </Link>
          <h1>{journey.title}</h1>
          <p className="muted">
            <code>{journey.slug}</code>
          </p>
          {!editor.canPublish ? (
            <p className="banner banner-info">
              Read-only mode. Only ADMIN/CONTENT_ADMIN can edit or publish.
            </p>
          ) : null}
        </div>
      </header>

      <JourneyEditorShell
        canPublish={editor.canPublish}
        journey={{
          id: journey.id,
          slug: journey.slug,
          title: journey.title,
          description: journey.description,
        }}
        versions={journey.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          status: v.status,
          beatCount: v._count.beats,
          gateCount: v._count.gates,
          updatedAt: v.updatedAt.toISOString(),
        }))}
        draftBeats={draftBeats.map((b) => ({
          id: b.id,
          sourceKey: b.sourceKey,
          kind: b.kind,
          title: b.title,
          prompt: b.prompt,
          sortOrder: b.sortOrder,
          scoringWeight: b.scoringWeight,
          config: b.config,
        }))}
        draftGates={draftGates}
        beatRefs={draftBeats.map((b) => `beat:${b.sourceKey}`)}
        knownModuleRefs={knownModuleRefs}
        assignments={journey.assignmentRules}
        auditLog={journey.auditLogs.map((a) => ({
          id: a.id,
          action: a.action,
          actorId: a.actorId,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
