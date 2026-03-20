import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buildContextTrail } from "@/lib/context-trail";
import ContextTrail from "@/components/context-trail";
import { PathwayActionButtons } from "./pathway-actions-client";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";

function getRunStatusLabel(status: "NOT_OFFERED" | "COMING_SOON" | "ACTIVE" | "PAUSED") {
  switch (status) {
    case "ACTIVE":
      return "Running here";
    case "COMING_SOON":
      return "Coming soon";
    case "PAUSED":
      return "Paused locally";
    default:
      return "Not offered here";
  }
}

function getRunStatusStyle(status: "NOT_OFFERED" | "COMING_SOON" | "ACTIVE" | "PAUSED") {
  switch (status) {
    case "ACTIVE":
      return { background: "#f0fdf4", color: "#166534" };
    case "COMING_SOON":
      return { background: "#eff6ff", color: "#1d4ed8" };
    case "PAUSED":
      return { background: "#fff7ed", color: "#c2410c" };
    default:
      return { background: "#f3f4f6", color: "#4b5563" };
  }
}

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [journey, trailItems] = await Promise.all([
    getStudentChapterJourneyData(session.user.id),
    buildContextTrail({ route: "/pathways", userId: session.user.id }).catch(() => []),
  ]);

  const visiblePathways = journey.visiblePathways;
  const localPathways = visiblePathways.filter((pathway) => pathway.hasLocalRun || pathway.isEnrolled);
  const libraryPathways = visiblePathways.filter((pathway) => !localPathways.some((entry) => entry.id === pathway.id));
  const nextStepsCount = visiblePathways.filter(
    (pathway) => pathway.nextRecommendedStep && !pathway.isComplete
  ).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">YPP Pathways</p>
          <h1 className="page-title">Pathways Library</h1>
          <p className="page-subtitle">
            {journey.chapterName
              ? `${journey.chapterName} runs some pathways locally and keeps the rest visible in the library.`
              : "Browse the full pathway library and see what is running locally."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-chapter" className="button">
            My Chapter Hub
          </Link>
          <Link href="/pathways/progress" className="button outline small">
            My Progress
          </Link>
        </div>
      </div>

      <ContextTrail items={trailItems} />

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Chapter-First Pathways</h3>
          <p style={{ color: "var(--gray-600)" }}>
            Pathways are shared across the network, but your chapter only runs the journeys it has instructors and capacity for.
            Local runs appear first. If the next step is missing locally, you will see partner-chapter fallback options in your chapter hub.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{localPathways.length}</div>
              <div className="kpi-label">Local / Active Pathways</div>
            </div>
            <div>
              <div className="kpi">{nextStepsCount}</div>
              <div className="kpi-label">Next Steps Ready</div>
            </div>
            <div>
              <div className="kpi">{visiblePathways.filter((pathway) => pathway.isComplete).length}</div>
              <div className="kpi-label">Completed</div>
            </div>
            <div>
              <div className="kpi">{visiblePathways.length}</div>
              <div className="kpi-label">Visible Library</div>
            </div>
          </div>
        </div>
      </div>

      {localPathways.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-title">Local Runs First</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {localPathways.map((pathway) => (
              <div key={pathway.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0 }}>
                        <Link href={`/pathways/${pathway.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {pathway.name}
                        </Link>
                      </h3>
                      <span className="pill">{pathway.interestArea}</span>
                      <span className="pill" style={getRunStatusStyle(pathway.runStatus)}>
                        {getRunStatusLabel(pathway.runStatus)}
                      </span>
                      {pathway.ownerName && (
                        <span className="pill">Lead: {pathway.ownerName}</span>
                      )}
                    </div>
                    <p style={{ margin: "8px 0 0", color: "var(--gray-600)", fontSize: 14 }}>
                      {pathway.description}
                    </p>
                    {pathway.hasLegacyOnlySteps && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#92400e" }}>
                        Some older steps still need migration before they can appear in the live student journey.
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-600)", marginBottom: 4 }}>
                      <span>{pathway.completedCount} / {pathway.totalCount} mapped steps</span>
                      <strong>{pathway.progressPercent}%</strong>
                    </div>
                    <div style={{ height: 8, background: "var(--gray-200, #e5e7eb)", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pathway.progressPercent}%`,
                          height: "100%",
                          background: pathway.progressPercent === 100 ? "#22c55e" : "var(--ypp-purple)",
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 10, fontSize: 13, color: "var(--gray-500)" }}>
                      {pathway.nextRecommendedStep
                        ? `Next: ${pathway.nextRecommendedStep.title}`
                        : pathway.isComplete
                          ? "Complete"
                          : "No mapped step ready"}
                    </div>
                  </div>
                </div>

                {pathway.localNextOffering ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#faf5ff",
                      border: "1px solid #e9d5ff",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Local next class</div>
                    <div style={{ fontSize: 14 }}>
                      <Link href={`/curriculum/${pathway.localNextOffering.id}`} style={{ color: "var(--ypp-purple)", fontWeight: 600 }}>
                        {pathway.localNextOffering.title}
                      </Link>
                      {" · "}
                      {pathway.localNextOffering.meetingDays.join(", ")} · {pathway.localNextOffering.meetingTime}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--gray-600)" }}>
                      {pathway.localNextOffering.locationName
                        ? `${pathway.localNextOffering.locationName}${pathway.localNextOffering.locationAddress ? ` — ${pathway.localNextOffering.locationAddress}` : ""}`
                        : pathway.localNextOffering.chapterLabel}
                    </div>
                  </div>
                ) : pathway.fallbackOfferings.length > 0 ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Local run missing for the next step</div>
                    <div style={{ fontSize: 14, color: "var(--gray-700)" }}>
                      Open <Link href="/my-chapter" style={{ color: "var(--ypp-purple)", fontWeight: 600 }}>My Chapter</Link> to request a partner-chapter fallback.
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pathway.steps.slice(0, 5).map((step) => (
                      <span
                        key={step.id}
                        className="pill"
                        style={
                          step.status === "COMPLETED"
                            ? { background: "#dcfce7", color: "#166534" }
                            : step.status === "ENROLLED" || step.status === "WAITLISTED"
                              ? { background: "#ede9fe", color: "var(--ypp-purple)" }
                              : {}
                        }
                      >
                        {step.title}
                      </span>
                    ))}
                  </div>

                  {pathway.isEnrolled || pathway.localNextOffering ? (
                    <PathwayActionButtons
                      pathwayId={pathway.id}
                      isEnrolled={pathway.isEnrolled}
                      progressPercent={pathway.progressPercent}
                      nextStepHref={`/pathways/${pathway.id}`}
                    />
                  ) : (
                    <Link href={`/pathways/${pathway.id}`} className="button outline small">
                      Open Pathway
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">Full Library</div>
        {libraryPathways.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              Everything visible to you is already in the local-first section above.
            </p>
          </div>
        ) : (
          <div className="grid two">
            {libraryPathways.map((pathway) => (
              <div key={pathway.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>
                      <Link href={`/pathways/${pathway.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {pathway.name}
                      </Link>
                    </h3>
                    <span className="pill">{pathway.interestArea}</span>
                    <span className="pill" style={getRunStatusStyle(pathway.runStatus)}>
                      {getRunStatusLabel(pathway.runStatus)}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--gray-600)" }}>
                    {pathway.description}
                  </p>
                </div>

                <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  {pathway.totalCount} mapped steps · {pathway.localAvailableStepCount} step{pathway.localAvailableStepCount === 1 ? "" : "s"} available in your chapter
                </div>

                {pathway.fallbackOfferings.length > 0 && (
                  <p style={{ margin: 0, fontSize: 13, color: "#1d4ed8" }}>
                    Partner-chapter fallback exists when you reach the next step.
                  </p>
                )}

                <div style={{ marginTop: "auto" }}>
                  <Link href={`/pathways/${pathway.id}`} className="button outline small">
                    View Library Entry
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
