import Link from "next/link";
import { notFound } from "next/navigation";

import { requireJourneyEditor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

import { ModuleContentEditor } from "./module-content-editor";

export const dynamic = "force-dynamic";

export default async function AdminModuleContentPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const editor = await requireJourneyEditor();
  const { moduleId } = await params;

  const trainingModule = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      contentKey: true,
      interactiveJourney: {
        select: {
          id: true,
          estimatedMinutes: true,
          passScorePct: true,
          strictMode: true,
          beats: {
            // Live / prebuilt beats only — versioned drafts have their own editor.
            where: { journeyVersionId: null, removedAt: null },
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
          },
        },
      },
    },
  });

  if (!trainingModule) notFound();

  const journey = trainingModule.interactiveJourney;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link className="link-back" href="/admin/training">
            ← Training modules
          </Link>
          <h1>{trainingModule.title}</h1>
          <p className="muted">
            Edit the exact lesson content learners see inside this module.
          </p>
        </div>
      </header>

      {!journey ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>No interactive content yet</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            {trainingModule.type === "INTERACTIVE_JOURNEY" ? (
              <>
                This module is an interactive journey but has no beats imported
                yet. Run <code>npm run training:import</code> to seed its
                content, then refresh.
              </>
            ) : (
              <>
                This is a <strong>{trainingModule.type}</strong> module, not an
                interactive journey. Use the module&rsquo;s{" "}
                <Link className="link" href="/admin/training">
                  Full editor
                </Link>{" "}
                to manage its video, checkpoints, quiz, and resources.
              </>
            )}
          </p>
        </section>
      ) : (
        <ModuleContentEditor
          canPublish={editor.canPublish}
          moduleId={trainingModule.id}
          moduleTitle={trainingModule.title}
          moduleDescription={trainingModule.description}
          journey={{
            id: journey.id,
            estimatedMinutes: journey.estimatedMinutes,
            passScorePct: journey.passScorePct,
            strictMode: journey.strictMode,
          }}
          beats={journey.beats.map((b) => ({
            id: b.id,
            sourceKey: b.sourceKey,
            kind: b.kind,
            title: b.title,
            prompt: b.prompt,
            sortOrder: b.sortOrder,
            scoringWeight: b.scoringWeight,
            config: b.config,
          }))}
        />
      )}
    </main>
  );
}
