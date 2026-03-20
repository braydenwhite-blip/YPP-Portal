import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSingleStudentPathwayJourney,
  type JourneyOfferingSummary,
  type JourneyStepSummary,
} from "@/lib/chapter-pathway-journey";
import { PathwayActionButtons } from "../pathway-actions-client";
import { StepEnrollButton } from "./step-enroll-client";

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
      return { background: "#dcfce7", color: "#166534" };
    case "COMING_SOON":
      return { background: "#dbeafe", color: "#1d4ed8" };
    case "PAUSED":
      return { background: "#ffedd5", color: "#c2410c" };
    default:
      return { background: "#f3f4f6", color: "#4b5563" };
  }
}

function getStepStatusLabel(step: JourneyStepSummary) {
  if (step.status === "NOT_STARTED" && step.requirementsMet) {
    return "Ready";
  }

  return step.status.replace("_", " ");
}

function getStepStatusStyle(step: JourneyStepSummary) {
  switch (step.status) {
    case "COMPLETED":
      return { background: "#dcfce7", color: "#166534" };
    case "ENROLLED":
      return { background: "#ede9fe", color: "#6d28d9" };
    case "WAITLISTED":
      return { background: "#fef3c7", color: "#92400e" };
    default:
      return step.requirementsMet
        ? { background: "#eff6ff", color: "#1d4ed8" }
        : { background: "#f3f4f6", color: "#4b5563" };
  }
}

function getStepBorder(step: JourneyStepSummary) {
  if (step.status === "COMPLETED") {
    return "4px solid #22c55e";
  }

  if (step.status === "ENROLLED" || step.status === "WAITLISTED") {
    return "4px solid var(--ypp-purple)";
  }

  if (step.requirementsMet) {
    return "4px solid #60a5fa";
  }

  return "4px solid #d1d5db";
}

function formatDateRange(startDate: Date, endDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatDeliveryMode(mode: "IN_PERSON" | "VIRTUAL" | "HYBRID") {
  return mode.replace("_", " ");
}

function formatChapterLabel(name: string | null, city: string | null, region: string | null) {
  if (!name) return "your chapter";
  if (city && region) return `${name} in ${city}, ${region}`;
  if (city) return `${name} in ${city}`;
  return name;
}

type OfferingRow = JourneyOfferingSummary & {
  stepOrder: number;
  stepTitle: string;
};

function uniqueOfferingRows(rows: OfferingRow[]) {
  const rowsById = new Map<string, OfferingRow>();

  for (const row of rows) {
    if (!rowsById.has(row.id)) {
      rowsById.set(row.id, row);
    }
  }

  return [...rowsById.values()].sort(
    (left, right) =>
      left.startDate.getTime() - right.startDate.getTime() ||
      left.stepOrder - right.stepOrder ||
      left.title.localeCompare(right.title)
  );
}

function OfferingOptionCard({
  offering,
  stepLabel,
  partnerMode = false,
}: {
  offering: JourneyOfferingSummary;
  stepLabel: string;
  partnerMode?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        margin: 0,
        padding: 14,
        borderRadius: 16,
        background: partnerMode ? "#eff6ff" : "var(--gray-50, #f9fafb)",
        border: partnerMode ? "1px solid #bfdbfe" : "1px solid var(--gray-200, #e5e7eb)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="pill">{stepLabel}</span>
            <span className="pill">{formatDeliveryMode(offering.deliveryMode)}</span>
            {partnerMode && offering.chapterLabel ? <span className="pill">{offering.chapterLabel}</span> : null}
            {partnerMode && offering.requestStatus ? (
              <span
                className="pill"
                style={
                  offering.requestStatus === "APPROVED"
                    ? { background: "#dcfce7", color: "#166534" }
                    : offering.requestStatus === "PENDING"
                      ? { background: "#e0f2fe", color: "#075985" }
                      : offering.requestStatus === "REJECTED"
                        ? { background: "#fee2e2", color: "#991b1b" }
                        : { background: "#f3f4f6", color: "#4b5563" }
                }
              >
                Request {offering.requestStatus.toLowerCase()}
              </span>
            ) : null}
          </div>

          <h4 style={{ marginTop: 0, marginBottom: 6 }}>{offering.title}</h4>
          <p style={{ margin: 0, fontSize: 13, color: "var(--gray-600)" }}>
            {formatDateRange(offering.startDate, offering.endDate)} · {offering.meetingDays.join(", ")} · {offering.meetingTime}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gray-500)" }}>
            Instructor: {offering.instructorName} · {offering.enrolledCount} enrolled
          </p>
          {offering.locationName ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gray-500)" }}>
              {offering.deliveryMode === "IN_PERSON" ? "In person at" : "Location:"} {offering.locationName}
              {offering.locationAddress ? `, ${offering.locationAddress}` : ""}
            </p>
          ) : null}
          {!offering.locationName && offering.chapterLabel ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gray-500)" }}>
              Chapter: {offering.chapterLabel}
            </p>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <Link href={`/curriculum/${offering.id}`} className="button outline small">
            View class
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function PathwayDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [pathway, viewer] = await Promise.all([
    getSingleStudentPathwayJourney(session.user.id, params.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        chapterId: true,
        chapter: {
          select: {
            name: true,
            city: true,
            region: true,
          },
        },
      },
    }),
  ]);

  if (!pathway) notFound();
  if (!pathway.isVisibleInChapter && !pathway.isEnrolled) {
    notFound();
  }

  const upcomingEvents = await prisma.pathwayEvent
    .findMany({
      where: {
        pathwayId: pathway.id,
        eventDate: { gte: new Date() },
        ...(viewer?.chapterId
          ? {
              OR: [{ chapterId: null }, { chapterId: viewer.chapterId }],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        locationOrLink: true,
        maxAttendees: true,
        requiredStepOrder: true,
        chapter: { select: { name: true } },
        pathwayStep: {
          select: {
            stepOrder: true,
            title: true,
            classTemplate: { select: { title: true } },
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      take: 5,
    })
    .catch(() => []);

  const chapterLabel = formatChapterLabel(
    viewer?.chapter?.name ?? null,
    viewer?.chapter?.city ?? null,
    viewer?.chapter?.region ?? null
  );

  const completedSteps = pathway.steps.filter((step) => step.status === "COMPLETED");
  const inFlightSteps = pathway.steps.filter(
    (step) => step.status === "ENROLLED" || step.status === "WAITLISTED"
  );
  const readySteps = pathway.steps.filter(
    (step) => step.status === "NOT_STARTED" && step.requirementsMet
  );
  const lockedSteps = pathway.steps.filter(
    (step) => step.status === "NOT_STARTED" && !step.requirementsMet
  );

  const localOfferingRows = uniqueOfferingRows(
    pathway.steps.flatMap((step) =>
      step.localOfferings.map((offering) => ({
        ...offering,
        stepOrder: step.stepOrder,
        stepTitle: step.title,
      }))
    )
  );

  const partnerOfferingRows = uniqueOfferingRows(
    pathway.steps.flatMap((step) =>
      step.partnerOfferings.map((offering) => ({
        ...offering,
        stepOrder: step.stepOrder,
        stepTitle: step.title,
      }))
    )
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/pathways" style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← All Pathways
          </Link>
          <p className="badge" style={{ marginTop: 6 }}>{pathway.interestArea}</p>
          <h1 className="page-title">{pathway.name}</h1>
          <p className="page-subtitle">{pathway.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-chapter" className="button outline small">
            My Chapter Hub
          </Link>
          <Link href={`/pathways/${pathway.id}/events`} className="button outline small">
            Milestone Events
          </Link>
          <Link href={`/pathways/${pathway.id}/leaderboard`} className="button outline small">
            Leaderboard
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <span className="pill" style={getRunStatusStyle(pathway.runStatus)}>
                  {getRunStatusLabel(pathway.runStatus)}
                </span>
                <span className="pill">{chapterLabel}</span>
                <span className="pill">{pathway.totalCount} mapped step{pathway.totalCount === 1 ? "" : "s"}</span>
                {pathway.ownerName ? <span className="pill">Lead: {pathway.ownerName}</span> : null}
                {pathway.hasLegacyOnlySteps ? (
                  <span className="pill" style={{ background: "#fff7ed", color: "#c2410c" }}>
                    Legacy-only steps still need migration
                  </span>
                ) : null}
              </div>

              <p style={{ margin: "0 0 12px", color: "var(--gray-600)" }}>
                This pathway is now chapter-first. You move through class-backed academic steps, see local runs before network options, and only use partner fallback when your next step is not available in {chapterLabel}.
              </p>

              <div style={{ display: "grid", gap: 6, fontSize: 14, color: "var(--gray-600)" }}>
                <div><strong>Local run coverage:</strong> {pathway.localAvailableStepCount} of {pathway.totalCount} mapped steps currently have a local class attached.</div>
                <div><strong>Academic progression:</strong> Progress is tracked through class enrollments and completions, not the old course-enrollment flow.</div>
                <div><strong>Partner continuity:</strong> When a local next step is missing, partner chapter offerings can be requested through your chapter hub.</div>
              </div>
            </div>

            <div style={{ minWidth: 220 }}>
              <div className="grid two" style={{ gap: 12 }}>
                <div>
                  <div className="kpi">{completedSteps.length}</div>
                  <div className="kpi-label">Completed</div>
                </div>
                <div>
                  <div className="kpi">{inFlightSteps.length}</div>
                  <div className="kpi-label">Active now</div>
                </div>
                <div>
                  <div className="kpi">{readySteps.length}</div>
                  <div className="kpi-label">Ready next</div>
                </div>
                <div>
                  <div className="kpi">{lockedSteps.length}</div>
                  <div className="kpi-label">Locked</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--gray-600)" }}>
            <span>{pathway.completedCount} / {pathway.totalCount} steps complete</span>
            <strong>{pathway.progressPercent}%</strong>
          </div>
          <div style={{ height: 10, background: "var(--gray-200, #e5e7eb)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${pathway.progressPercent}%`, height: "100%", background: pathway.isComplete ? "#22c55e" : "var(--ypp-purple)" }} />
          </div>

          {pathway.isComplete ? (
            <>
              <div className="onboarding-callout" style={{ background: "#f0fdf4", color: "#166534" }}>
                You have completed every mapped academic step in this pathway.
              </div>
              <PathwayActionButtons
                pathwayId={pathway.id}
                isEnrolled={true}
                progressPercent={pathway.progressPercent}
                nextStepHref={`/pathways/${pathway.id}/certificate`}
              />
            </>
          ) : pathway.currentStep ? (
            <>
              <div style={{ fontSize: 14, color: "var(--gray-600)" }}>
                <strong>Current step:</strong> Step {pathway.currentStep.stepOrder} - {pathway.currentStep.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                {pathway.currentStep.status === "WAITLISTED"
                  ? "You are waitlisted on a class attached to this step."
                  : "You are actively moving through this step right now."}
              </div>
              <PathwayActionButtons
                pathwayId={pathway.id}
                isEnrolled={true}
                progressPercent={pathway.progressPercent}
                nextStepHref={`/pathways/${pathway.id}`}
              />
            </>
          ) : pathway.localNextOffering ? (
            <>
              <div style={{ fontSize: 14 }}>
                <strong>Next local class:</strong>{" "}
                <Link href={`/curriculum/${pathway.localNextOffering.id}`} style={{ color: "var(--ypp-purple)" }}>
                  {pathway.localNextOffering.title}
                </Link>
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-600)" }}>
                {pathway.localNextOffering.meetingDays.join(", ")} · {pathway.localNextOffering.meetingTime}
                {pathway.localNextOffering.locationName ? ` · ${pathway.localNextOffering.locationName}` : ""}
              </div>
              <StepEnrollButton pathwayId={pathway.id} label="Join Local Next Step" />
            </>
          ) : pathway.fallbackOfferings.length > 0 ? (
            <>
              <div style={{ fontSize: 14, color: "var(--gray-600)" }}>
                Your chapter is not running the next required step right now, but partner chapter options are available.
              </div>
              <Link href="/my-chapter" className="button">
                Open My Chapter
              </Link>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "var(--gray-600)" }}>
              No local or partner run is posted for the next required step yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pathway checkpoints</h3>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            Think of this like the pathway version of class learning outcomes. Each checkpoint becomes available once the required earlier step is complete.
          </p>
          <div style={{ marginTop: 12 }}>
            {pathway.steps.map((step, index) => (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: index < pathway.steps.length - 1 ? "1px solid var(--border-light)" : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: getStepStatusStyle(step).background,
                    color: getStepStatusStyle(step).color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {step.status === "COMPLETED" ? "✓" : step.stepOrder}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{step.title}</strong>
                    <span className="pill" style={getStepStatusStyle(step)}>
                      {getStepStatusLabel(step)}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--gray-500)" }}>
                    {step.requiredStepTitles.length > 0
                      ? `Unlocks after: ${step.requiredStepTitles.join(", ")}`
                      : "This is an entry step with no mapped academic prerequisite."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Chapter run details</h3>
          <div style={{ display: "grid", gap: 10, fontSize: 14, color: "var(--gray-600)" }}>
            <div>
              <strong>Local chapter:</strong> {chapterLabel}
            </div>
            <div>
              <strong>Run status:</strong> {getRunStatusLabel(pathway.runStatus)}
            </div>
            <div>
              <strong>Current pathway owner:</strong> {pathway.ownerName ?? "No owner assigned yet"}
            </div>
            <div>
              <strong>Visible in chapter:</strong> {pathway.isVisibleInChapter ? "Yes" : "No, but still visible because you are already on it"}
            </div>
            <div>
              <strong>Local academic availability:</strong> {pathway.localAvailableStepCount} mapped steps currently have chapter-linked class offerings.
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "var(--gray-50, #f9fafb)", border: "1px solid var(--gray-200, #e5e7eb)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>How this page should guide you</div>
            <div style={{ fontSize: 13, color: "var(--gray-600)" }}>
              Start with the local class schedule below. If your next required step is missing locally, check the partner chapter section or open My Chapter to request fallback access.
            </div>
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Local class schedule</h3>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            These are the class offerings already mapped into this pathway for {chapterLabel}.
          </p>
          {localOfferingRows.length === 0 ? (
            <p style={{ margin: 0, color: "var(--gray-500)" }}>
              No local class offerings are attached to this pathway yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {localOfferingRows.map((offering) => (
                <OfferingOptionCard
                  key={offering.id}
                  offering={offering}
                  stepLabel={`Step ${offering.stepOrder}: ${offering.stepTitle}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Partner chapter options</h3>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            These are network runs attached to the same pathway steps. They matter most when your next required step is not available locally.
          </p>
          {partnerOfferingRows.length === 0 ? (
            <p style={{ margin: 0, color: "var(--gray-500)" }}>
              No partner chapter offerings are currently attached to this pathway.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {partnerOfferingRows.slice(0, 6).map((offering) => (
                <OfferingOptionCard
                  key={offering.id}
                  offering={offering}
                  stepLabel={`Step ${offering.stepOrder}: ${offering.stepTitle}`}
                  partnerMode
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="section-title">Chapter Journey Outline</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pathway.steps.map((step) => (
            <div key={step.id} className="card" style={{ borderLeft: getStepBorder(step) }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>Step {step.stepOrder}</strong>
                    <span>{step.title}</span>
                    <span className="pill" style={getStepStatusStyle(step)}>
                      {getStepStatusLabel(step)}
                    </span>
                    {step.isLocallyAvailable ? (
                      <span className="pill" style={{ background: "#f0fdf4", color: "#166534" }}>
                        Local class posted
                      </span>
                    ) : null}
                    {step.partnerOfferings.length > 0 ? (
                      <span className="pill" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                        {step.partnerOfferings.length} partner option{step.partnerOfferings.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--gray-600)" }}>
                    {step.requiredStepTitles.length > 0
                      ? `Unlocks after: ${step.requiredStepTitles.join(", ")}`
                      : "No mapped academic prerequisite. Students can begin here."}
                  </p>

                  {step.localOfferings.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Local options for this step</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {step.localOfferings.map((offering) => (
                          <OfferingOptionCard
                            key={offering.id}
                            offering={offering}
                            stepLabel={`Step ${step.stepOrder}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {step.partnerOfferings.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Partner chapter runs for this step</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {step.partnerOfferings.map((offering) => (
                          <OfferingOptionCard
                            key={offering.id}
                            offering={offering}
                            stepLabel={`Step ${step.stepOrder}`}
                            partnerMode
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {step.localOfferings.length === 0 && step.partnerOfferings.length === 0 ? (
                    <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--gray-500)" }}>
                      No class offering is currently attached to this step.
                    </p>
                  ) : null}
                </div>

                <div style={{ minWidth: 220, maxWidth: 260 }}>
                  <div style={{ padding: 14, borderRadius: 16, background: "var(--gray-50, #f9fafb)", border: "1px solid var(--gray-200, #e5e7eb)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Step guidance</div>
                    <div style={{ fontSize: 13, color: "var(--gray-600)", display: "grid", gap: 8 }}>
                      <div>
                        {step.status === "COMPLETED"
                          ? "This step is finished."
                          : step.status === "ENROLLED"
                            ? "You are enrolled in a class for this step."
                            : step.status === "WAITLISTED"
                              ? "You are waitlisted on a class for this step."
                              : step.requirementsMet
                                ? "You can join this step as soon as a class is available."
                                : "Finish the prerequisite step first."}
                      </div>
                      <div>
                        <strong>Local offerings:</strong> {step.localOfferings.length}
                      </div>
                      <div>
                        <strong>Partner offerings:</strong> {step.partnerOfferings.length}
                      </div>
                      <div>
                        <strong>Fallback posture:</strong>{" "}
                        {step.localOfferings.length > 0
                          ? "Stay local first."
                          : step.partnerOfferings.length > 0
                            ? "Use chapter approval if needed."
                            : "Wait for a posted run."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Advisory milestone events</h3>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            Milestone events add support and visibility around the journey, but they do not block academic step completion.
          </p>
          {upcomingEvents.length === 0 ? (
            <p style={{ margin: 0, color: "var(--gray-500)" }}>
              No upcoming milestone events are scheduled yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingEvents.map((event) => (
                <div key={event.id} style={{ paddingBottom: 10, borderBottom: "1px solid var(--gray-100, #f3f4f6)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span className="pill">
                      {event.eventDate
                        ? new Date(event.eventDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "Date TBD"}
                    </span>
                    {event.chapter?.name ? <span className="pill">{event.chapter.name}</span> : <span className="pill">Network-wide</span>}
                    {event.requiredStepOrder ? (
                      <span className="pill">After Step {event.requiredStepOrder}</span>
                    ) : null}
                  </div>
                  <div style={{ fontWeight: 700 }}>{event.title}</div>
                  {event.description ? (
                    <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 4 }}>{event.description}</div>
                  ) : null}
                  <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 4 }}>
                    {event.locationOrLink ? event.locationOrLink : "Location or link coming soon"}
                    {event.maxAttendees ? ` · ${event._count.registrations} / ${event.maxAttendees} registered` : ""}
                  </div>
                  {event.pathwayStep ? (
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 4 }}>
                      Connected step: Step {event.pathwayStep.stepOrder} - {event.pathwayStep.classTemplate?.title ?? event.pathwayStep.title ?? "Untitled step"}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href={`/pathways/${pathway.id}/events`} style={{ color: "var(--ypp-purple)" }}>
              Open all milestone events →
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>More pathway tools</h3>
          <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
            Use these tools to track progress, reflect on each step, connect with mentors, and share completions.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Link href={`/pathways/${pathway.id}/certificate`} className="button outline small">
              Certificate
            </Link>
            <Link href={`/pathways/${pathway.id}/leaderboard`} className="button outline small">
              Leaderboard
            </Link>
            <Link href={`/pathways/${pathway.id}/mentors`} className="button outline small">
              Mentors
            </Link>
            <Link href={`/pathways/${pathway.id}/journal`} className="button outline small">
              Journal
            </Link>
          </div>
          <div style={{ padding: 14, borderRadius: 14, background: "var(--gray-50, #f9fafb)", border: "1px solid var(--gray-200, #e5e7eb)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Right now in this journey</div>
            <div style={{ fontSize: 13, color: "var(--gray-600)", display: "grid", gap: 6 }}>
              <div><strong>Completed steps:</strong> {completedSteps.length}</div>
              <div><strong>Active steps:</strong> {inFlightSteps.length}</div>
              <div><strong>Ready but not started:</strong> {readySteps.length}</div>
              <div><strong>Network fallback options:</strong> {partnerOfferingRows.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
