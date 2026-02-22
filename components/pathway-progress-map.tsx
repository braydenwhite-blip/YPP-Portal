"use client";

interface PathwayStep {
  id: string;
  courseId: string;
  courseTitle: string;
  courseLevel: string | null;
  courseFormat: string;
  stepOrder: number;
}

interface PathwayWithProgress {
  id: string;
  name: string;
  interestArea: string;
  steps: PathwayStep[];
  completedCourseIds: Set<string>;
  enrolledCourseIds: Set<string>;
}

export default function PathwayProgressMap({
  pathways,
}: {
  pathways: PathwayWithProgress[];
}) {
  if (pathways.length === 0) {
    return (
      <div className="card">
        <div className="section-title">My Pathway Progress</div>
        <p className="empty">
          No pathways selected yet. Visit{" "}
          <a href="/pathways" style={{ color: "var(--ypp-purple)", fontWeight: 500 }}>Pathways</a>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title">My Pathway Progress</div>
      <div className="pathway-maps">
        {pathways.map((pathway) => {
          const completedCount = pathway.steps.filter(
            (s) => pathway.completedCourseIds.has(s.courseId)
          ).length;
          const progress = pathway.steps.length > 0
            ? completedCount / pathway.steps.length
            : 0;

          return (
            <div key={pathway.id} className="pathway-map">
              <div className="pathway-map-header">
                <div>
                  <h3 className="pathway-map-name">{pathway.name}</h3>
                  <span className="pathway-map-area">{pathway.interestArea}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="pathway-map-progress-text">
                    {completedCount}/{pathway.steps.length} completed
                  </span>
                  {completedCount > 0 && completedCount === pathway.steps.length && (
                    <a
                      href={`/pathways/${pathway.id}/certificate`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--ypp-purple, #7c3aed)",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View Certificate →
                    </a>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="pathway-map-bar">
                <div
                  className="pathway-map-bar-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              {/* Step nodes */}
              <div className="pathway-map-nodes">
                {pathway.steps.map((step, idx) => {
                  const isCompleted = pathway.completedCourseIds.has(step.courseId);
                  const isEnrolled = pathway.enrolledCourseIds.has(step.courseId);
                  const isCurrent = isEnrolled && !isCompleted;
                  const isLocked = !isCompleted && !isEnrolled;

                  let nodeClass = "pathway-node";
                  if (isCompleted) nodeClass += " completed";
                  else if (isCurrent) nodeClass += " current";
                  else if (isLocked) nodeClass += " locked";

                  const levelLabel = step.courseLevel
                    ? step.courseLevel.replace("LEVEL_", "")
                    : step.courseFormat.replace("_", " ");

                  return (
                    <div key={step.id} className="pathway-node-wrapper">
                      {idx > 0 && (
                        <div className={`pathway-connector-line ${isCompleted || isCurrent ? "active" : ""}`} />
                      )}
                      <div className={nodeClass}>
                        <div className="pathway-node-circle">
                          {isCompleted ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span className="pathway-node-number">{idx + 1}</span>
                          )}
                        </div>
                        <div className="pathway-node-label">
                          <span className="pathway-node-level">{levelLabel}</span>
                          <span className="pathway-node-title">{step.courseTitle}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
