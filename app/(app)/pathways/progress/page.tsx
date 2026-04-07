import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";

function getStepPillStyle(status: "COMPLETED" | "ENROLLED" | "WAITLISTED" | "NOT_STARTED") {
  switch (status) {
    case "COMPLETED":
      return { background: "#dcfce7", color: "#166534" };
    case "ENROLLED":
      return { background: "#f0e6ff", color: "var(--ypp-purple)" };
    case "WAITLISTED":
      return { background: "#fef3c7", color: "#92400e" };
    default:
      return { background: "#f3f4f6", color: "#374151" };
  }
}

export default async function PathwayProgressPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [snapshot, journey] = await Promise.all([
    getStudentProgressSnapshot(session.user.id),
    getStudentChapterJourneyData(session.user.id),
  ]);

  const pathways = journey.visiblePathways;
  const activePathways = pathways.filter((pathway) => pathway.isEnrolled || pathway.progressPercent > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Learning</p>
          <h1 className="page-title">Pathway Progress Dashboard</h1>
          <p className="page-subtitle">
            {journey.chapterName
              ? `Your chapter-first progress view for ${journey.chapterName}.`
              : "Your chapter-first progress view."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-chapter" className="button secondary">
            My Chapter Hub
          </Link>
          <Link href="/pathways" className="button secondary">
            Browse Pathways
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Unified Progress Snapshot</h3>
        <div className="grid four" style={{ marginTop: 10 }}>
          <div>
            <div className="kpi">{snapshot.activeEnrollments}</div>
            <div className="kpi-label">Active Enrollments</div>
          </div>
          <div>
            <div className="kpi">{snapshot.nextPathwaySteps}</div>
            <div className="kpi-label">Pathway Next Steps</div>
          </div>
          <div>
            <div className="kpi">{snapshot.dueAssignmentsNext7Days}</div>
            <div className="kpi-label">Assignments Due (7d)</div>
          </div>
          <div>
            <div className="kpi">{snapshot.trainingDue}</div>
            <div className="kpi-label">Training Due</div>
          </div>
        </div>
      </div>

      {pathways.length === 0 ? (
        <div className="card">
          <h3>No Pathway Progress Yet</h3>
          <p>
            Your chapter has not exposed any pathways to your journey yet. Open the chapter hub to
            see local pathways and the next step you can take.
          </p>
          <Link href="/my-chapter" className="button primary" style={{ marginTop: 12 }}>
            Open My Chapter
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {activePathways.length === 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Visible pathways</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
                Your chapter can see pathways in the library, even if you have not started one yet.
              </p>
            </div>
          )}

          {pathways.map((pathway) => {
            const nextStep = pathway.nextRecommendedStep;
            const lockedSteps = pathway.steps.filter(
              (step) => step.status === "NOT_STARTED" && !step.requirementsMet
            );

            return (
              <div key={pathway.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <h2 style={{ marginTop: 0 }}>{pathway.name}</h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      {pathway.description}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="pill">{pathway.interestArea}</span>
                      <span className="pill">{pathway.runStatus.replace("_", " ")}</span>
                      {pathway.isEnrolled && <span className="pill">You are in this pathway</span>}
                      {pathway.hasLegacyOnlySteps && <span className="pill">Legacy steps still need mapping</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="kpi">{pathway.progressPercent}%</div>
                    <div className="kpi-label">Complete</div>
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: 8,
                    backgroundColor: "var(--border)",
                    borderRadius: 4,
                    overflow: "hidden",
                    marginTop: 18,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: `${pathway.progressPercent}%`,
                      height: "100%",
                      backgroundColor: "var(--ypp-purple)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div className="grid three" style={{ marginBottom: 24 }}>
                  <div>
                    <div className="kpi">{pathway.completedCount}</div>
                    <div className="kpi-label">Completed</div>
                  </div>
                  <div>
                    <div className="kpi">{pathway.currentStep ? 1 : 0}</div>
                    <div className="kpi-label">In Progress</div>
                  </div>
                  <div>
                    <div className="kpi">{lockedSteps.length}</div>
                    <div className="kpi-label">Upcoming</div>
                  </div>
                </div>

                {nextStep ? (
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: "var(--ypp-purple-50)",
                      borderRadius: 6,
                      marginBottom: 20,
                    }}
                  >
                    <strong>Next step:</strong> {nextStep.title}
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {nextStep.requirementsMet
                        ? "This step is ready when a local class offering appears."
                        : `Finish the earlier mapped step${nextStep.requiredStepTitles.length > 0 ? `, starting with ${nextStep.requiredStepTitles[0]}` : ""}.`}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: "var(--gray-50)",
                      borderRadius: 6,
                      marginBottom: 20,
                    }}
                  >
                    This pathway is complete in the new chapter-first system.
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="pill" style={getStepPillStyle(pathway.currentStep?.status ?? "NOT_STARTED")}>
                    Current: {pathway.currentStep ? pathway.currentStep.title : "None"}
                  </span>
                  {pathway.localNextOffering ? (
                    <span className="pill" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                      Local next class: {pathway.localNextOffering.title}
                    </span>
                  ) : null}
                  {pathway.fallbackOfferings.length > 0 ? (
                    <span className="pill" style={{ background: "#fef3c7", color: "#92400e" }}>
                      Partner fallback available
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
