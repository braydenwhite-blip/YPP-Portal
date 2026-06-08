import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getClassOfferingDetail } from "@/lib/class-management-actions";
import { getLearnerFitSummary } from "@/lib/learner-fit";
import Link from "next/link";
import { ClassDetailClient } from "./client";
import { SessionManager } from "./session-manager";
import { AnnouncementsPanel } from "./announcements";
import { InstructorReflectionForm } from "./instructor-reflection";
import { getStudentClassOpportunityContext } from "@/lib/student-class-portal";
import { derivePublicClassStatus, formatScheduleSummary } from "@/lib/class-status";
import { PublicClassStatusBadge } from "@/components/classes/public-class-status-badge";
import { Meter } from "@/components/people-strategy/people-suite";
import { StarRating } from "@/components/classes/star-rating";
import { ClassFeedbackForm } from "@/components/classes/class-feedback-form";
import {
  getClassFeedbackSummary,
  getClassOutcome,
  getMyClassFeedback,
} from "@/lib/class-feedback";

function getEmbeddedIntroVideoUrl(videoUrl: string, provider: string | null) {
  if (!provider) return null;

  if (provider === "YOUTUBE") {
    const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }

  if (provider === "VIMEO") {
    const match = videoUrl.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  if (provider === "LOOM") {
    const match = videoUrl.match(/loom\.com\/share\/([^?]+)/);
    return match ? `https://www.loom.com/embed/${match[1]}` : null;
  }

  return null;
}

function AlternativeOfferingCard({
  offering,
}: {
  offering: Awaited<ReturnType<typeof getStudentClassOpportunityContext>>["alternatives"][number];
}) {
  const learnerFit = getLearnerFitSummary({
    learnerFitLabel: offering.template.learnerFitLabel,
    learnerFitDescription: offering.template.learnerFitDescription,
    difficultyLevel: offering.template.difficultyLevel,
  });

  return (
    <Link
      href={`/curriculum/${offering.id}`}
      className="card"
      style={{ textDecoration: "none", color: "inherit", margin: 0 }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span
          className="pill"
          style={{
            background: learnerFit.accent + "18",
            color: learnerFit.accent,
            fontWeight: 600,
          }}
        >
          {learnerFit.label}
        </span>
        <span className="pill">{offering.template.interestArea}</span>
        {offering.reasonLabel ? <span className="pill pill-info">{offering.reasonLabel}</span> : null}
      </div>

      <h4 style={{ marginTop: 0, marginBottom: 6 }}>{offering.title}</h4>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0 }}>
        {offering.chapterLabel ?? "Open class"} · {offering.meetingDays.join(", ")} · {offering.meetingTime}
      </p>

      {offering.nextSession ? (
        <p style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 600, marginTop: 8 }}>
          Next:{" "}
          {offering.nextSession.date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          at {offering.nextSession.startTime}
        </p>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {offering.isFull ? (
          <span className="pill" style={{ background: "#fffbeb", color: "#b45309" }}>
            Waitlist
          </span>
        ) : (
          <span className="pill" style={{ background: "#f0fdf4", color: "#166534" }}>
            {offering.spotsLeft} spot{offering.spotsLeft === 1 ? "" : "s"} left
          </span>
        )}
        {offering.recommendationReasons[0] ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {offering.recommendationReasons[0]}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const [offering, opportunityContext] = await Promise.all([
    getClassOfferingDetail(id),
    getStudentClassOpportunityContext(id, session.user.id),
  ]);

  if (!offering) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Classes</p>
            <h1 className="page-title">Class Not Found</h1>
          </div>
        </div>
        <div className="card">
          <p>This class could not be found.</p>
          <Link href="/curriculum" className="button primary" style={{ marginTop: 16 }}>
            Browse Classes
          </Link>
        </div>
      </div>
    );
  }

  const roles = session.user.roles ?? [];
  const isInstructor = offering.instructorId === session.user.id || roles.includes("ADMIN");
  const enrolledStudents = offering.enrollments.filter((e) => e.status === "ENROLLED");
  const waitlistedStudents = offering.enrollments.filter((e) => e.status === "WAITLISTED");

  const myEnrollment = offering.enrollments.find((e) => e.student.id === session.user.id);
  const isEnrolled = myEnrollment?.status === "ENROLLED";
  const isWaitlisted = myEnrollment?.status === "WAITLISTED";
  const spotsLeft = offering.capacity - enrolledStudents.length;
  const publicStatus = derivePublicClassStatus({
    status: offering.status,
    enrollmentOpen: offering.enrollmentOpen,
    capacity: offering.capacity,
    enrolledCount: enrolledStudents.length,
    startDate: offering.startDate,
    endDate: offering.endDate,
  });
  const scheduleSummary = formatScheduleSummary({
    sessionCount: offering.sessions.length,
    meetingDays: offering.meetingDays,
    meetingTime: offering.meetingTime,
    startDate: offering.startDate,
    endDate: offering.endDate,
  });
  const upcomingSessions = offering.sessions.filter(
    (s) => new Date(s.date) >= new Date() && !s.isCancelled
  );
  const pastSessions = offering.sessions.filter(
    (s) => new Date(s.date) < new Date() || s.isCancelled
  );

  const completionPct = offering.template.learningOutcomes.length > 0 && myEnrollment
    ? Math.round(((myEnrollment.outcomesAchieved?.length || 0) / offering.template.learningOutcomes.length) * 100)
    : null;
  const learnerFit = getLearnerFitSummary({
    learnerFitLabel: offering.template.learnerFitLabel,
    learnerFitDescription: offering.template.learnerFitDescription,
    difficultyLevel: offering.template.difficultyLevel,
  });
  const showEnrollmentSupport =
    !isInstructor &&
    (spotsLeft <= 0 ||
      (opportunityContext.requiresFallbackApproval &&
        opportunityContext.fallbackRequestStatus !== "APPROVED"));

  // Class feedback + completion-outcome layer. The instructor sees a wrap-up
  // reflection form plus a read-only summary of student feedback; an enrolled
  // student whose class has ended sees the post-class feedback form.
  const classHasEnded =
    offering.status === "COMPLETED" || new Date(offering.endDate) < new Date();
  const showStudentFeedback = !isInstructor && isEnrolled && classHasEnded;
  const [feedbackSummary, classOutcome, myFeedback] = await Promise.all([
    isInstructor ? getClassFeedbackSummary(id) : Promise.resolve(null),
    isInstructor ? getClassOutcome(id) : Promise.resolve(null),
    showStudentFeedback
      ? getMyClassFeedback(session.user.id, id)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/curriculum" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Back to Catalog
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{offering.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {offering.pathwayStep?.pathway && (
            <Link href={`/pathways/${offering.pathwayStep.pathway.id}`} className="button secondary">
              View Pathway
            </Link>
          )}
          <Link href={`/curriculum/${id}/assignments`} className="button secondary">
            Assignments
          </Link>
          {isInstructor && (
            <Link
              href={`/instructor/class-settings?offering=${offering.id}`}
              className="button secondary"
            >
              Manage Class
            </Link>
          )}
        </div>
      </div>

      {/* Class Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
              {offering.template.description}
            </p>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>Free enrichment class</span>
              {" · "}taught by a trained YPP student instructor{" · "}supported by YPP
            </p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <span className="pill" style={{
                background: learnerFit.accent + "18",
                color: learnerFit.accent,
                fontWeight: 600,
              }}>
                {learnerFit.label}
              </span>
              <span className="pill">{offering.template.interestArea}</span>
              <span className="pill">
                {offering.deliveryMode === "VIRTUAL" ? "Online" : offering.deliveryMode === "IN_PERSON" ? "In person" : "Hybrid"}
              </span>
              <PublicClassStatusBadge info={publicStatus} />
              {offering.chapter && (
                <span className="pill">
                  {offering.chapter.city ? `${offering.chapter.name} (${offering.chapter.city})` : offering.chapter.name}
                </span>
              )}
              {offering.semester && <span className="pill">{offering.semester}</span>}
              {offering.pathwayStep?.pathway && (
                <Link
                  href={`/pathways/${offering.pathwayStep.pathway.id}`}
                  className="pill"
                  style={{
                    background: "var(--ypp-purple-100, #f0e6ff)",
                    color: "var(--ypp-purple, #6b21c8)",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 11,
                  }}
                >
                  Step {offering.pathwayStep.stepOrder} in {offering.pathwayStep.pathway.name} →
                </Link>
              )}
            </div>

            <div style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div><strong>Instructor:</strong> {offering.instructor.name}</div>
              {offering.pathwayStep?.pathway ? (
                <div>
                  <strong>Pathway:</strong>{" "}
                  <Link href={`/pathways/${offering.pathwayStep.pathway.id}`} style={{ color: "var(--ypp-purple)" }}>
                    Step {offering.pathwayStep.stepOrder} in {offering.pathwayStep.pathway.name}
                  </Link>
                </div>
              ) : null}
              {offering.chapter ? (
                <div>
                  <strong>Hosted by:</strong> {offering.chapter.name}
                  {offering.chapter.city ? ` (${offering.chapter.city}${offering.chapter.region ? `, ${offering.chapter.region}` : ""})` : ""}
                </div>
              ) : null}
              <div><strong>Schedule:</strong> {scheduleSummary}</div>
              <div>
                <strong>Dates:</strong>{" "}
                {new Date(offering.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                {" - "}
                {new Date(offering.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <div><strong>Duration:</strong> {offering.template.durationWeeks} weeks ({offering.sessions.length} sessions)</div>
              <div><strong>Who it&apos;s for:</strong> {learnerFit.description}</div>
              {offering.zoomLink && (
                <div><strong>Zoom:</strong>{" "}
                  <a href={offering.zoomLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)" }}>
                    Join Meeting
                  </a>
                </div>
              )}
              {offering.locationName && (
                <div><strong>Location:</strong> {offering.locationName}{offering.locationAddress ? ` - ${offering.locationAddress}` : ""}</div>
              )}
            </div>
          </div>

          {/* Enrollment Action */}
          <div style={{ textAlign: "center", minWidth: 200 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--ypp-purple)" }}>
              {enrolledStudents.length} / {offering.capacity}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>enrolled</div>
            <div style={{ marginBottom: 8 }}>
              <Meter
                value={enrolledStudents.length}
                max={Math.max(1, offering.capacity)}
                tone={publicStatus.status === "FULL_WAITLIST" ? "danger" : publicStatus.status === "ALMOST_FULL" ? "warning" : "success"}
              />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {publicStatus.helper ?? (spotsLeft > 0 ? `${spotsLeft} spots remaining` : "Class is full")}
            </div>

            <ClassDetailClient
              offeringId={offering.id}
              title={offering.title}
              interestArea={offering.template.interestArea}
              learnerFitLabel={learnerFit.label}
              deliveryMode={offering.deliveryMode.replace("_", " ")}
              meetingDays={offering.meetingDays}
              meetingTime={offering.meetingTime}
              startDate={new Date(offering.startDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              hasZoomLink={Boolean(offering.zoomLink)}
              hasLocation={Boolean(offering.locationName)}
              isEnrolled={isEnrolled}
              isWaitlisted={isWaitlisted}
              isFull={spotsLeft <= 0}
              isInstructor={isInstructor}
              enrollmentOpen={offering.enrollmentOpen}
              waitlistPosition={myEnrollment?.waitlistPosition ?? undefined}
              requiresFallbackApproval={opportunityContext.requiresFallbackApproval}
              fallbackRequestStatus={opportunityContext.fallbackRequestStatus}
              canRequestFallback={opportunityContext.canRequestFallback}
              fallbackPathwayId={opportunityContext.fallbackPathwayId}
              fallbackPathwayStepId={opportunityContext.fallbackPathwayStepId}
            />

            {completionPct !== null && isEnrolled && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div style={{ color: "var(--text-secondary)" }}>Learning Progress</div>
                <div style={{
                  width: "100%",
                  height: 8,
                  background: "var(--gray-200)",
                  borderRadius: 4,
                  marginTop: 4,
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${completionPct}%`,
                    height: "100%",
                    background: "var(--ypp-purple)",
                    borderRadius: 4,
                    transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ marginTop: 4, color: "var(--ypp-purple)", fontWeight: 600 }}>
                  {completionPct}% outcomes achieved
                </div>
              </div>
            )}

            {!isInstructor && !isEnrolled && !isWaitlisted && publicStatus.canSignUp && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  textAlign: "left",
                  background: "var(--gray-50, #f9fafb)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>What happens next</strong>
                {publicStatus.isWaitlist
                  ? "You'll join the waitlist. We'll move you into the class — and notify you right here — the moment a seat opens."
                  : "You're enrolled right away. Your schedule and joining details appear in My Classes, and your instructor shares what to prepare before the first session."}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEnrollmentSupport && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {opportunityContext.requiresFallbackApproval &&
            opportunityContext.fallbackRequestStatus !== "APPROVED" ? (
              <>
                <h3 style={{ margin: 0 }}>Partner-chapter access support</h3>
                {opportunityContext.fallbackRequestStatus ? (
                  <span
                    className="pill"
                    style={
                      opportunityContext.fallbackRequestStatus === "PENDING"
                        ? { background: "#e0f2fe", color: "#075985", fontWeight: 700 }
                        : opportunityContext.fallbackRequestStatus === "REJECTED"
                          ? { background: "#fee2e2", color: "#991b1b", fontWeight: 700 }
                          : { background: "#f3f4f6", color: "#374151", fontWeight: 700 }
                    }
                  >
                    {opportunityContext.fallbackRequestStatus.toLowerCase()}
                  </span>
                ) : null}
              </>
            ) : (
              <h3 style={{ margin: 0 }}>This class is full right now</h3>
            )}
          </div>

          <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
            {opportunityContext.requiresFallbackApproval &&
            opportunityContext.fallbackRequestStatus !== "APPROVED"
              ? "You can request partner-chapter access from the class card above. While that is pending, here are other classes that keep you moving."
              : "You can still join the waitlist, and you do not have to stop there. These similar options can keep your momentum going right away."}
          </p>

          {opportunityContext.alternatives.length > 0 ? (
            <div className="grid two" style={{ marginTop: 14 }}>
              {opportunityContext.alternatives.map((alternative) => (
                <AlternativeOfferingCard key={alternative.id} offering={alternative} />
              ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--gray-100)",
                color: "var(--text-secondary)",
              }}
            >
              No close alternatives are available yet. You can still use the catalog or your pathway view to look for the next best fit.
            </div>
          )}
        </div>
      )}

      {/* Post-class feedback (enrolled student, class has ended) */}
      {showStudentFeedback && (
        <div
          className="card"
          style={{ marginBottom: 24, borderLeft: "4px solid #f59e0b" }}
        >
          <h3 style={{ marginTop: 0 }}>
            {myFeedback ? "Your feedback" : "How was this class?"}
          </h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, marginBottom: 14 }}>
            Now that this class has wrapped up, your feedback helps your
            instructor and the YPP team make the next one even better.
          </p>
          <ClassFeedbackForm
            offeringId={offering.id}
            defaultRating={myFeedback?.rating ?? 0}
            defaultLiked={myFeedback?.liked ?? ""}
            defaultImprove={myFeedback?.improve ?? ""}
            defaultRecommend={
              myFeedback?.wouldRecommend == null
                ? ""
                : myFeedback.wouldRecommend
                  ? "yes"
                  : "no"
            }
            submittedAt={myFeedback?.createdAt ?? null}
          />
        </div>
      )}

      {/* Instructor Intro Video */}
      {offering.introVideoUrl && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>{offering.introVideoTitle || `Meet ${offering.instructor.name}`}</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, marginBottom: 14 }}>
            {offering.introVideoDescription || "Watch a quick introduction to this class from your instructor."}
          </p>

          {offering.introVideoProvider === "CUSTOM" ? (
            <video
              controls
              preload="metadata"
              poster={offering.introVideoThumbnail || undefined}
              style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
            >
              <source src={offering.introVideoUrl} />
              Your browser does not support video playback.
            </video>
          ) : getEmbeddedIntroVideoUrl(offering.introVideoUrl, offering.introVideoProvider) ? (
            <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <iframe
                src={getEmbeddedIntroVideoUrl(offering.introVideoUrl, offering.introVideoProvider)!}
                title={offering.introVideoTitle || `${offering.title} intro video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          ) : (
            <a href={offering.introVideoUrl} target="_blank" rel="noopener noreferrer" className="link">
              Watch instructor intro video
            </a>
          )}
        </div>
      )}

      {/* Prerequisites */}
      {(offering.template.prerequisites?.length ?? 0) > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Prerequisites</h3>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {offering.template.prerequisites.map((prereq, i) => (
              <span key={i} className="pill">{prereq}</span>
            ))}
          </div>
        </div>
      )}

      {/* Learning Outcomes */}
      {offering.template.learningOutcomes.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Learning Outcomes</h3>
          <div style={{ marginTop: 12 }}>
            {offering.template.learningOutcomes.map((outcome, i) => {
              const isAchieved = myEnrollment?.outcomesAchieved?.includes(outcome);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: i < offering.template.learningOutcomes.length - 1 ? "1px solid var(--border-light)" : "none",
                  }}
                >
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    flexShrink: 0,
                    ...(isAchieved
                      ? { background: "#f0fdf4", color: "#16a34a" }
                      : { background: "var(--gray-100)", color: "var(--gray-400)" }),
                  }}>
                    {isAchieved ? "✓" : (i + 1)}
                  </span>
                  <span style={{ color: isAchieved ? "var(--text)" : "var(--text-secondary)" }}>
                    {outcome}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course Outline / Weekly Topics */}
      {(() => {
        const topics = Array.isArray(offering.template.weeklyTopics) ? offering.template.weeklyTopics as { week?: number; topic?: string; milestone?: string; materials?: string }[] : [];
        return topics.length > 0 ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3>Course Outline</h3>
            <div style={{ marginTop: 12 }}>
              {topics.map((wt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: i < topics.length - 1 ? "1px solid var(--border-light)" : "none",
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--ypp-purple-100, #f0e6ff)",
                    color: "var(--ypp-purple, #6b21c8)",
                    fontWeight: 700,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {wt.week ?? i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{wt.topic || `Week ${i + 1}`}</div>
                    {wt.milestone && (
                      <div style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 2 }}>
                        Milestone: {wt.milestone}
                      </div>
                    )}
                    {wt.materials && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        Materials: {wt.materials}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Class Schedule */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Upcoming Sessions */}
        <div className="card">
          <h3>Upcoming Sessions ({upcomingSessions.length})</h3>
          {upcomingSessions.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>No upcoming sessions</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {upcomingSessions.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Session {s.sessionNumber}: {s.topic}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" | "}
                        {s.startTime} - {s.endTime}
                      </div>
                      {s.description && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                          {s.description}
                        </div>
                      )}
                      {s.learningOutcomes.length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          Goals: {s.learningOutcomes.join(", ")}
                        </div>
                      )}
                      {s.materialsUrl && (
                        <a
                          href={s.materialsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, display: "inline-block" }}
                        >
                          📄 Session Materials
                        </a>
                      )}
                      {s.notesUrl && (
                        <a
                          href={s.notesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, marginLeft: 12, display: "inline-block" }}
                        >
                          📝 Notes
                        </a>
                      )}
                    </div>
                    {s.milestone && (
                      <span className="pill" style={{ fontSize: 11, flexShrink: 0 }}>
                        {s.milestone}
                      </span>
                    )}
                  </div>
                  {isInstructor && (
                    <SessionManager
                      session={{
                        id: s.id,
                        sessionNumber: s.sessionNumber,
                        topic: s.topic,
                        description: s.description ?? "",
                        materialsUrl: s.materialsUrl ?? "",
                        notesUrl: s.notesUrl ?? "",
                        recordingUrl: s.recordingUrl ?? "",
                        isCancelled: s.isCancelled,
                        cancelReason: s.cancelReason ?? "",
                      }}
                      offeringId={offering.id}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        <div className="card">
          <h3>Past Sessions ({pastSessions.length})</h3>
          {pastSessions.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>No past sessions yet</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {pastSessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-light)",
                    opacity: s.isCancelled ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Session {s.sessionNumber}: {s.topic}
                        {s.isCancelled && <span style={{ color: "#ef4444" }}> (Cancelled)</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      {s.recordingUrl && (
                        <a
                          href={s.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, display: "inline-block" }}
                        >
                          ▶ Watch Recording
                        </a>
                      )}
                      {s.materialsUrl && (
                        <a
                          href={s.materialsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, marginLeft: s.recordingUrl ? 12 : 0, display: "inline-block" }}
                        >
                          📄 Materials
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                      {s._count.attendance} attended
                    </div>
                  </div>
                  {isInstructor && !s.isCancelled && (
                    <SessionManager
                      session={{
                        id: s.id,
                        sessionNumber: s.sessionNumber,
                        topic: s.topic,
                        description: s.description ?? "",
                        materialsUrl: s.materialsUrl ?? "",
                        notesUrl: s.notesUrl ?? "",
                        recordingUrl: s.recordingUrl ?? "",
                        isCancelled: s.isCancelled,
                        cancelReason: s.cancelReason ?? "",
                      }}
                      offeringId={offering.id}
                      enrolledStudents={enrolledStudents.map((e) => ({
                        id: e.student.id,
                        name: e.student.name ?? "Unknown",
                      }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructor View: Enrolled Students */}
      {isInstructor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Enrolled Students ({enrolledStudents.length})</h3>
          {enrolledStudents.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>No students enrolled yet</p>
          ) : (
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Why they signed up</th>
                  <th>Sessions Attended</th>
                  <th>Outcomes Achieved</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td style={{ fontWeight: 500 }}>
                      {enrollment.student.name}
                      <div style={{ fontWeight: 400, fontSize: 12, color: "var(--text-secondary)" }}>
                        {enrollment.student.email}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 240 }}>
                      {enrollment.signupGoal ? <div>🎯 {enrollment.signupGoal}</div> : null}
                      {enrollment.signupNote ? (
                        <div style={{ fontStyle: "italic" }}>“{enrollment.signupNote}”</div>
                      ) : null}
                      {!enrollment.signupGoal && !enrollment.signupNote ? (
                        <span style={{ color: "var(--gray-400, #9ca3af)" }}>—</span>
                      ) : null}
                    </td>
                    <td>
                      {enrollment.sessionsAttended} / {offering.sessions.length}
                    </td>
                    <td>
                      {enrollment.outcomesAchieved?.length || 0} / {offering.template.learningOutcomes.length}
                    </td>
                    <td>
                      <span className="pill primary" style={{ fontSize: 11 }}>
                        {enrollment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {waitlistedStudents.length > 0 && (
            <>
              <h4 style={{ marginTop: 24, marginBottom: 8 }}>Waitlist ({waitlistedStudents.length})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {waitlistedStudents.map((enrollment, i) => (
                  <div
                    key={enrollment.id}
                    style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", gap: 8 }}
                  >
                    <span>#{i + 1}</span>
                    <span>{enrollment.student.name}</span>
                    <span>({enrollment.student.email})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Instructor: student feedback summary + wrap-up reflection */}
      {isInstructor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Class feedback &amp; reflection</h3>

          {feedbackSummary && feedbackSummary.responseCount > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--border-light, #eee)",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>
                    {feedbackSummary.avgRating.toFixed(1)}
                  </span>
                  <StarRating value={Math.round(feedbackSummary.avgRating)} size={18} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {feedbackSummary.responseCount} student
                  {feedbackSummary.responseCount === 1 ? "" : "s"} rated this class
                </div>
              </div>
              {feedbackSummary.recommendPct !== null && (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {Math.round(feedbackSummary.recommendPct * 100)}%
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    would recommend it
                  </div>
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>
                Individual comments are shared with the YPP team on the admin class
                page.
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)", marginTop: 0, marginBottom: 16 }}>
              No student feedback yet. Students can rate the class once it has
              wrapped up.
            </p>
          )}

          <InstructorReflectionForm
            offeringId={offering.id}
            defaultWentWell={classOutcome?.instructorWentWell ?? ""}
            defaultChallenges={classOutcome?.instructorChallenges ?? ""}
            defaultStudentImpact={classOutcome?.instructorStudentImpact ?? ""}
            defaultWouldTeachAgain={
              classOutcome?.instructorWouldTeachAgain == null
                ? ""
                : classOutcome.instructorWouldTeachAgain
                  ? "yes"
                  : "no"
            }
            reflectedAt={classOutcome?.instructorReflectedAt ?? null}
          />
        </div>
      )}

      {/* Announcements */}
      <AnnouncementsPanel
        offeringId={offering.id}
        announcements={(offering as { announcements?: { id: string; title: string; body: string; isPinned: boolean; createdAt: Date; author: { id: string; name: string | null } }[] }).announcements ?? []}
        isInstructor={isInstructor}
      />

      {/* Class Size Recommendation */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Class Size Info</h3>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
              {offering.template.minStudents}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Min Students</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
              {offering.template.idealSize}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Ideal Size</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
              {offering.template.maxStudents}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Max Capacity</div>
          </div>
        </div>
        {offering.template.sizeNotes && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
            {offering.template.sizeNotes}
          </p>
        )}
      </div>
    </div>
  );
}
