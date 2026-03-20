import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";
import { FallbackRequestButton } from "./fallback-request-button";

function formatDateRange(startDate: Date, endDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatChapterLabel(name: string | null, city: string | null, region: string | null) {
  if (!name) return "Your chapter";
  if (city && region) return `${name} in ${city}, ${region}`;
  if (city) return `${name} in ${city}`;
  return name;
}

function formatDeliveryMode(mode: "IN_PERSON" | "VIRTUAL" | "HYBRID") {
  return mode.replace("_", " ");
}

function statusTone(status: string | null | undefined) {
  switch (status) {
    case "COMPLETED":
      return { background: "#dcfce7", color: "#166534" };
    case "ENROLLED":
      return { background: "#ede9fe", color: "#6d28d9" };
    case "WAITLISTED":
      return { background: "#fef3c7", color: "#92400e" };
    case "PENDING":
      return { background: "#e0f2fe", color: "#075985" };
    case "APPROVED":
      return { background: "#dcfce7", color: "#166534" };
    case "REJECTED":
    case "CANCELLED":
      return { background: "#fee2e2", color: "#991b1b" };
    default:
      return { background: "#f3f4f6", color: "#374151" };
  }
}

export default async function MyChapterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = new Set(session.user.roles ?? []);
  const canReviewFallbacks = roles.has("ADMIN") || roles.has("STAFF") || roles.has("CHAPTER_LEAD");
  const journey = await getStudentChapterJourneyData(session.user.id);
  const localPathways = journey.activeLocalPathways;
  const secondaryPathways = journey.visiblePathways.filter((pathway) => !pathway.hasLocalRun);
  const spotlightPathway = localPathways[0] ?? journey.visiblePathways[0] ?? null;
  const pendingFallbackRequests = journey.pathways.flatMap((pathway) =>
    pathway.steps.flatMap((step) =>
      step.allOfferings
        .filter((offering) => offering.requestStatus === "PENDING")
        .map((offering) => ({
          pathwayId: pathway.id,
          pathwayName: pathway.name,
          stepId: step.id,
          stepTitle: step.title,
          offering,
        }))
    )
  );

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">My Chapter</p>
          <h1 className="page-title">
            {journey.chapterName ? journey.chapterName : "Your chapter hub"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--gray-600)" }}>
            {formatChapterLabel(journey.chapterName, journey.chapterCity, journey.chapterRegion)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/pathways" className="button outline small">
            Full Pathway Library
          </Link>
          <Link href="/curriculum" className="button outline small">
            Browse Classes
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>What this page does</h3>
          <p style={{ marginBottom: 0, color: "var(--gray-600)" }}>
            This is your chapter-first home. It puts local pathways, the next step you can take,
            and partner-chapter fallback options in one place.
          </p>
        </div>
        <div className="card">
          <div className="grid two" style={{ gap: 12 }}>
            <div>
              <div className="kpi">{localPathways.length}</div>
              <div className="kpi-label">Local pathways</div>
            </div>
            <div>
              <div className="kpi">{journey.visiblePathways.length}</div>
              <div className="kpi-label">Visible pathways</div>
            </div>
            <div>
              <div className="kpi">{pendingFallbackRequests.length}</div>
              <div className="kpi-label">Pending fallback requests</div>
            </div>
            <div>
              <div className="kpi">{journey.activeLocalPathways.filter((pathway) => pathway.isComplete).length}</div>
              <div className="kpi-label">Completed locally</div>
            </div>
          </div>
          {canReviewFallbacks ? (
            <div style={{ marginTop: 14 }}>
              <Link href="/chapter/pathway-fallbacks" className="button outline small">
                Review fallback requests
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {spotlightPathway && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <p className="section-title" style={{ marginTop: 0 }}>Next step spotlight</p>
              <h3 style={{ marginTop: 0 }}>{spotlightPathway.name}</h3>
              <p style={{ marginTop: 0, color: "var(--gray-600)" }}>{spotlightPathway.description}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="pill">{spotlightPathway.interestArea}</span>
                <span className="pill">{spotlightPathway.runStatus.replace("_", " ")}</span>
                {spotlightPathway.ownerName ? <span className="pill">Owned by {spotlightPathway.ownerName}</span> : null}
                {spotlightPathway.hasLegacyOnlySteps ? <span className="pill">Migration needed</span> : null}
              </div>
            </div>
            <div style={{ minWidth: 220 }}>
              <div className="kpi">{spotlightPathway.progressPercent}%</div>
              <div className="kpi-label">Pathway progress</div>
              <div style={{ marginTop: 10, height: 8, background: "var(--gray-200)", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${spotlightPathway.progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "var(--ypp-purple)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Local pathways first</div>
        {localPathways.length === 0 ? (
          <div className="card">
            <p style={{ marginTop: 0, color: "var(--gray-600)" }}>
              Your chapter does not have any active pathways yet. The full library is still available
              below, and the chapter lead can turn pathways on when local classes are ready.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {localPathways.map((pathway) => {
              const nextStep = pathway.nextRecommendedStep;

              return (
              <section key={pathway.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill">{pathway.interestArea}</span>
                      <span className="pill">{pathway.runStatus.replace("_", " ")}</span>
                      {pathway.isFeatured ? <span className="pill">Featured in chapter</span> : null}
                      {pathway.isComplete ? <span className="pill" style={{ background: "#dcfce7", color: "#166534" }}>Complete</span> : null}
                    </div>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                      <Link href={`/pathways/${pathway.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {pathway.name}
                      </Link>
                    </h3>
                    <p style={{ marginTop: 0, color: "var(--gray-600)" }}>{pathway.description}</p>
                    <p style={{ marginBottom: 0, color: "var(--gray-500)", fontSize: 13 }}>
                      {pathway.completedCount} of {pathway.totalCount} academic steps complete.
                      {pathway.ownerName ? ` Chapter lead: ${pathway.ownerName}.` : ""}
                    </p>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <div className="kpi">{pathway.progressPercent}%</div>
                    <div className="kpi-label">Progress</div>
                    <div style={{ marginTop: 10, height: 8, background: "var(--gray-200)", borderRadius: 999 }}>
                      <div
                        style={{
                          width: `${pathway.progressPercent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "var(--ypp-purple)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                  {nextStep ? (
                    <div style={{ padding: 16, borderRadius: 16, background: "var(--gray-50, #f9fafb)", border: "1px solid var(--gray-200, #e5e7eb)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div className="section-title" style={{ marginTop: 0 }}>Next step</div>
                          <h4 style={{ marginTop: 0, marginBottom: 6 }}>
                            Step {nextStep.stepOrder}: {nextStep.title}
                          </h4>
                          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
                            {nextStep.requirementsMet
                              ? "You can join this step now."
                              : "Finish the earlier academic step before you join this one."}
                          </p>
                        </div>
                        <div style={{ minWidth: 180 }}>
                          <span className="pill" style={statusTone(nextStep.status)}>
                            {nextStep.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      {nextStep.localOfferings.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Local offerings</div>
                          <div style={{ display: "grid", gap: 10 }}>
                            {nextStep.localOfferings.map((offering) => (
                              <div
                                key={offering.id}
                                className="card"
                                style={{ margin: 0, padding: 14, borderRadius: 14 }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div>
                                    <h4 style={{ marginTop: 0, marginBottom: 4 }}>{offering.title}</h4>
                                    <p style={{ margin: 0, color: "var(--gray-600)", fontSize: 13 }}>
                                      {formatDateRange(offering.startDate, offering.endDate)} · {formatDeliveryMode(offering.deliveryMode)}
                                      {offering.chapterLabel ? ` · ${offering.chapterLabel}` : ""}
                                    </p>
                                    <p style={{ margin: "6px 0 0", color: "var(--gray-500)", fontSize: 13 }}>
                                      Instructor: {offering.instructorName} · {offering.enrolledCount} enrolled
                                    </p>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <span className="pill" style={statusTone(offering.requestStatus)}>
                                      {offering.requestStatus ? `Request ${offering.requestStatus.toLowerCase()}` : "Local"}
                                    </span>
                                    <Link href={`/curriculum/${offering.id}`} className="button outline small">
                                      View class
                                    </Link>
                                  </div>
                                </div>
                                {offering.deliveryMode === "IN_PERSON" && offering.locationName ? (
                                  <p style={{ margin: "8px 0 0", color: "var(--gray-500)", fontSize: 13 }}>
                                    In-person at {offering.locationName}
                                    {offering.locationAddress ? `, ${offering.locationAddress}` : ""}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {nextStep.localOfferings.length === 0 &&
                        nextStep.partnerOfferings.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Partner chapter fallback options</div>
                            <div style={{ display: "grid", gap: 10 }}>
                              {nextStep.partnerOfferings.map((offering) => (
                                <div
                                  key={offering.id}
                                  className="card"
                                  style={{ margin: 0, padding: 14, borderRadius: 14 }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                    <div>
                                      <h4 style={{ marginTop: 0, marginBottom: 4 }}>{offering.title}</h4>
                                      <p style={{ margin: 0, color: "var(--gray-600)", fontSize: 13 }}>
                                        {formatDateRange(offering.startDate, offering.endDate)} · {formatDeliveryMode(offering.deliveryMode)}
                                        {offering.chapterLabel ? ` · ${offering.chapterLabel}` : ""}
                                      </p>
                                      <p style={{ margin: "6px 0 0", color: "var(--gray-500)", fontSize: 13 }}>
                                        Instructor: {offering.instructorName} · {offering.enrolledCount} enrolled
                                      </p>
                                    </div>
                                    <FallbackRequestButton
                                      pathwayId={pathway.id}
                                      pathwayStepId={nextStep.id}
                                      targetOfferingId={offering.id}
                                      requestStatus={offering.requestStatus}
                                    />
                                  </div>
                                  {offering.deliveryMode === "IN_PERSON" && offering.locationName ? (
                                    <p style={{ margin: "8px 0 0", color: "var(--gray-500)", fontSize: 13 }}>
                                      In-person at {offering.locationName}
                                      {offering.locationAddress ? `, ${offering.locationAddress}` : ""}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {nextStep.localOfferings.length === 0 &&
                      nextStep.partnerOfferings.length === 0 ? (
                        <p style={{ margin: "12px 0 0", color: "var(--gray-500)", fontSize: 13 }}>
                          No class offering is attached to this step yet.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ padding: 16, borderRadius: 16, background: "var(--gray-50, #f9fafb)", border: "1px solid var(--gray-200, #e5e7eb)" }}>
                      <strong>This pathway is complete.</strong>
                      <p style={{ marginBottom: 0, color: "var(--gray-600)" }}>
                        You have finished the academic steps that are currently mapped to class offerings.
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pathway.steps.map((step) => (
                      <span key={step.id} className="pill" style={statusTone(step.status)}>
                        Step {step.stepOrder}: {step.title}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Chapter pathways library</div>
        {secondaryPathways.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--gray-600)" }}>
              Everything your chapter sees right now is already local. When other pathways become
              visible here, they will appear as network options.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {secondaryPathways.map((pathway) => (
              <section key={pathway.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill">{pathway.interestArea}</span>
                      <span className="pill">Not offered here</span>
                      {pathway.hasLegacyOnlySteps ? <span className="pill">Migration needed</span> : null}
                    </div>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                      <Link href={`/pathways/${pathway.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {pathway.name}
                      </Link>
                    </h3>
                    <p style={{ marginTop: 0, color: "var(--gray-600)" }}>{pathway.description}</p>
                    <p style={{ marginBottom: 0, color: "var(--gray-500)", fontSize: 13 }}>
                      This pathway is visible in the network, but your chapter does not have a local run yet.
                    </p>
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <div className="kpi">{pathway.totalCount}</div>
                    <div className="kpi-label">Mapped steps</div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
