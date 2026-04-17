import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChapterPathwayToggle } from "./chapter-pathway-toggle";
import { getChapterRunStatusMeta, formatOwnerLabel } from "./pathway-run-metadata";

export default async function AdminPathwaysPage() {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
    redirect("/");
  }

  const userId = session.user.id;
  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true, chapter: { select: { id: true, name: true } } },
  });

  const chapterId = adminUser?.chapterId;
  const chapterName = adminUser?.chapter?.name ?? "Your Chapter";

  const [pathways, chapterConfigs, ownerOptions, unmappedLegacySteps] = await Promise.all([
    prisma.pathway.findMany({
      include: {
        steps: {
          include: {
            course: { select: { title: true } },
            classTemplate: { select: { title: true } },
          },
          orderBy: { stepOrder: "asc" },
        },
        _count: { select: { certificates: true } },
      },
      orderBy: { name: "asc" },
    }),
    chapterId
      ? prisma.chapterPathway.findMany({
          where: { chapterId },
          include: {
            owner: { select: { id: true, name: true, primaryRole: true } },
          },
        })
      : Promise.resolve([] as Array<{
          chapterId: string;
          pathwayId: string;
          isAvailable: boolean;
          isFeatured: boolean;
          runStatus: "NOT_OFFERED" | "COMING_SOON" | "ACTIVE" | "PAUSED";
          ownerId: string | null;
          owner: { id: string; name: string; primaryRole: string } | null;
          displayOrder: number;
        }>),
    chapterId
      ? prisma.user.findMany({
          where: { chapterId },
          select: { id: true, name: true, primaryRole: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; primaryRole: string }>),
    prisma.pathwayStep.findMany({
      where: {
        courseId: { not: null },
        classTemplateId: null,
      },
      include: {
        pathway: { select: { id: true, name: true, interestArea: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { stepOrder: "asc" },
    }),
  ]);

  const configMap = new Map(chapterConfigs.map((config) => [config.pathwayId, config]));

  const pathwayRows = pathways
    .map((pathway) => {
      const config = configMap.get(pathway.id);
      const runStatus = config?.runStatus ?? "NOT_OFFERED";
      const stepCount = pathway.steps.length;
      const mappedStepCount = pathway.steps.filter((step) => step.classTemplateId).length;
      const legacyOnlyStepCount = pathway.steps.filter((step) => step.courseId && !step.classTemplateId).length;

      return {
        pathway,
        config,
        runStatus,
        stepCount,
        mappedStepCount,
        legacyOnlyStepCount,
        isAvailable: config?.isAvailable ?? false,
        isFeatured: config?.isFeatured ?? false,
        displayOrder: config?.displayOrder ?? Number.MAX_SAFE_INTEGER,
        ownerId: config?.ownerId ?? null,
        owner: config?.owner ?? null,
      };
    })
    .sort((left, right) => {
      const leftMeta = getChapterRunStatusMeta(left.runStatus);
      const rightMeta = getChapterRunStatusMeta(right.runStatus);
      const statusOrder = {
        ACTIVE: 0,
        COMING_SOON: 1,
        PAUSED: 2,
        NOT_OFFERED: 3,
      } as const;

      return (
        statusOrder[left.runStatus] - statusOrder[right.runStatus] ||
        Number(right.isFeatured) - Number(left.isFeatured) ||
        (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.pathway.name.localeCompare(right.pathway.name) ||
        leftMeta.label.localeCompare(rightMeta.label)
      );
    });

  const totalPathways = pathwayRows.length;
  const activeRuns = pathwayRows.filter((row) => row.runStatus === "ACTIVE").length;
  const plannedRuns = pathwayRows.filter((row) => row.runStatus === "COMING_SOON").length;
  const pausedRuns = pathwayRows.filter((row) => row.runStatus === "PAUSED").length;
  const hiddenRuns = pathwayRows.filter((row) => !row.isAvailable || row.runStatus === "NOT_OFFERED").length;
  const ownersAssigned = pathwayRows.filter((row) => row.ownerId).length;
  const legacyOnlyStepCount = unmappedLegacySteps.length;
  const pathwaysWithLegacyOnlySteps = new Set(unmappedLegacySteps.map((step) => step.pathwayId)).size;
  const mappedSteps = pathways.reduce(
    (sum, pathway) => sum + pathway.steps.filter((step) => step.classTemplateId).length,
    0
  );
  const totalSteps = pathways.reduce((sum, pathway) => sum + pathway.steps.length, 0);
  const mappingProgress = totalSteps > 0 ? Math.round((mappedSteps / totalSteps) * 100) : 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Chapter-Run Pathways</h1>
          <p className="page-subtitle">Manage which global pathways your chapter actually runs and owns.</p>
        </div>
        <Link href="/admin/pathway-tracking" className="button outline small">
          View Analytics
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)" }}>
        <h3 style={{ marginTop: 0 }}>How this works now</h3>
        <p style={{ color: "var(--gray-600)", fontSize: 14, marginBottom: 12 }}>
          The chapter hub should lead the student journey. This page controls the chapter run behind the
          scenes, so only active or planned local pathways show up first for students in {chapterName}.
        </p>
        <div className="timeline" style={{ marginBottom: 0 }}>
          <div className="timeline-item"><strong>Active:</strong> the chapter is currently running the pathway with real offerings.</div>
          <div className="timeline-item"><strong>Coming soon:</strong> the pathway is planned, but students should not enroll yet.</div>
          <div className="timeline-item"><strong>Not offered:</strong> the pathway stays in the library, but it is not part of the local journey yet.</div>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{totalPathways}</div>
          <div className="kpi-label">Pathways in library</div>
        </div>
        <div className="card">
          <div className="kpi">{activeRuns}</div>
          <div className="kpi-label">Active local runs</div>
        </div>
        <div className="card">
          <div className="kpi">{plannedRuns}</div>
          <div className="kpi-label">Coming soon</div>
        </div>
        <div className="card">
          <div className="kpi">{legacyOnlyStepCount}</div>
          <div className="kpi-label">Legacy steps needing mapping</div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Chapter-run status</h3>
          <p style={{ color: "var(--gray-600)", fontSize: 14, marginTop: 0 }}>
            A pathway can exist globally without being locally offered yet. Owners help keep one person
            accountable for local scheduling, instructor coordination, and student support.
          </p>
          <div className="grid two" style={{ marginTop: 12 }}>
            <div>
              <div className="kpi">{pausedRuns}</div>
              <div className="kpi-label">Paused runs</div>
            </div>
            <div>
              <div className="kpi">{ownersAssigned}</div>
              <div className="kpi-label">Runs with owners</div>
            </div>
            <div>
              <div className="kpi">{hiddenRuns}</div>
              <div className="kpi-label">Hidden or not offered</div>
            </div>
            <div>
              <div className="kpi">{mappingProgress}%</div>
              <div className="kpi-label">Steps mapped to class templates</div>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Local-run note</h3>
          <p style={{ color: "var(--gray-600)", fontSize: 14, marginTop: 0 }}>
            This control panel is chapter-first. Students should see the chapter hub before the broad
            pathway catalog, and only pathways with a real local run should feel like the default next step.
          </p>
          <p style={{ color: "var(--gray-600)", fontSize: 14, marginBottom: 0 }}>
            Unmapped legacy steps still depend on `Course`/`Enrollment`, so they are surfaced here as an
            audit until each one is connected to a `ClassTemplate`.
          </p>
        </div>
      </div>

      {pathways.length === 0 ? (
        <div className="card"><p>No pathways exist yet. Contact a global admin to create pathways.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {pathwayRows.map(({ pathway, runStatus, isAvailable, isFeatured, displayOrder, owner, stepCount, mappedStepCount, legacyOnlyStepCount }) => {
            const runMeta = getChapterRunStatusMeta(runStatus);

            return (
              <div key={pathway.id} className="card" style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>{pathway.name}</h3>
                      <span
                        className="pill"
                        style={{ fontSize: 12, background: "rgba(255,255,255,0.7)", color: runMeta.tone, border: `1px solid ${runMeta.tone}` }}
                      >
                        {runMeta.label}
                      </span>
                      {isFeatured && (
                        <span className="pill" style={{ fontSize: 12, background: "var(--purple-50, #faf5ff)", color: "var(--ypp-purple)" }}>
                          ★ Featured
                        </span>
                      )}
                      {!isAvailable && (
                        <span className="pill" style={{ fontSize: 12, background: "var(--red-50, #fff5f5)", color: "var(--red-700, #c53030)" }}>
                          Hidden in chapter
                        </span>
                      )}
                      {!pathway.isActive && (
                        <span className="pill" style={{ fontSize: 12, color: "var(--gray-400)" }}>
                          Globally inactive
                        </span>
                      )}
                      {legacyOnlyStepCount > 0 && (
                        <span className="pill" style={{ fontSize: 12, background: "var(--amber-50, #fffbeb)", color: "var(--amber-700, #b45309)" }}>
                          {legacyOnlyStepCount} legacy step{legacyOnlyStepCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "6px 0 8px", fontSize: 14, color: "var(--gray-600)" }}>{pathway.description}</p>
                    <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                      {stepCount} steps · {mappedStepCount} mapped to class templates · {pathway._count.certificates} certificates issued
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                      {pathway.steps.map((step) => (
                        <span
                          key={step.id}
                          className="pill"
                          style={{
                            fontSize: 12,
                            background: step.classTemplateId ? "var(--green-50, #f0fdf4)" : "var(--gray-100, #f3f4f6)",
                            color: step.classTemplateId ? "var(--green-700, #15803d)" : "var(--gray-600)",
                          }}
                        >
                          {step.classTemplate?.title ?? step.course?.title ?? step.title ?? `Step ${step.stepOrder}`}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginBottom: 6 }}>Local run summary</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      <div><strong>Order:</strong> {displayOrder === Number.MAX_SAFE_INTEGER ? "Unset" : displayOrder}</div>
                      <div><strong>Owner:</strong> {formatOwnerLabel(owner)}</div>
                      <div><strong>Visibility:</strong> {isAvailable ? "Shown in chapter" : "Hidden from chapter"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, color: "var(--gray-600)" }}>
                    If this pathway is active or coming soon, students should meet it first in the chapter hub.
                    If it is not offered, it can still live in the library without becoming part of the local journey yet.
                  </div>

                  {chapterId ? (
                    <ChapterPathwayToggle
                      chapterId={chapterId}
                      pathwayId={pathway.id}
                      isAvailable={isAvailable}
                      isFeatured={isFeatured}
                      runStatus={runStatus}
                      ownerId={owner?.id ?? null}
                      displayOrder={displayOrder === Number.MAX_SAFE_INTEGER ? 0 : displayOrder}
                      ownerOptions={ownerOptions}
                    />
                  ) : (
                    <div className="pill" style={{ background: "var(--amber-50, #fffbeb)", color: "var(--amber-700, #b45309)" }}>
                      No chapter assigned to this admin account
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div className="section-title">Legacy Step Audit</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            These steps still point to legacy courses without a matching `ClassTemplate`. They should be
            mapped before the chapter-first journey can rely on them end to end.
          </p>
          <div className="grid three" style={{ marginTop: 12 }}>
            <div>
              <div className="kpi">{legacyOnlyStepCount}</div>
              <div className="kpi-label">Unmapped legacy steps</div>
            </div>
            <div>
              <div className="kpi">{pathwaysWithLegacyOnlySteps}</div>
              <div className="kpi-label">Pathways affected</div>
            </div>
            <div>
              <div className="kpi">{totalSteps - legacyOnlyStepCount}</div>
              <div className="kpi-label">Already mapped or informational</div>
            </div>
          </div>
        </div>

        {legacyOnlyStepCount === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>No unmapped legacy pathway steps were found. The chapter-first model has a clean mapping surface right now.</p>
          </div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Pathway</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Step</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Legacy course</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {unmappedLegacySteps.map((step) => (
                  <tr key={step.id} style={{ borderBottom: "1px solid var(--gray-100, #f7fafc)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{step.pathway.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{step.pathway.interestArea}</div>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <span className="pill">#{step.stepOrder}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{step.course?.title ?? "Legacy course missing"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--gray-600)" }}>
                      This step still depends on the old course-backed progress path, so it is not yet ready for
                      chapter-first student routing.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
