import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getLearnerFitSummary } from "@/lib/learner-fit";
import { getMyClassesHubData } from "@/lib/student-class-portal";

const NOTICE_COPY: Record<string, string> = {
  "my-courses-moved":
    "The older My Courses pages used a retired student course flow. Your active classes live here now.",
  "legacy-course-route":
    "That older class page used the retired course system. Use My Classes for live enrollments or browse the catalog for your next class.",
  "legacy-course-notification":
    "This notification pointed to an older class page. Use My Classes to continue with the current student class experience.",
};

export default async function MyClassesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    notice?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = (await searchParams) ?? {};
  const notice = params.notice ? NOTICE_COPY[params.notice] : null;
  const hub = await getMyClassesHubData(session.user.id);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Classes</p>
          <h1 className="page-title">My Classes</h1>
          <p className="page-subtitle">
            Your next sessions, due work, waitlists, and class updates all in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/curriculum" className="button secondary">
            Browse Classes
          </Link>
          <Link href="/curriculum/schedule" className="button secondary">
            Calendar View
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: "#eff6ff",
            borderLeft: "4px solid #2563eb",
          }}
        >
          <strong style={{ color: "#1d4ed8" }}>Student class pages moved</strong>
          <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>{notice}</p>
        </div>
      )}

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{hub.stats.activeCount}</div>
          <div className="kpi-label">Active Classes</div>
        </div>
        <div className="card">
          <div className="kpi">{hub.stats.upcomingSessionsCount}</div>
          <div className="kpi-label">Sessions This Week</div>
        </div>
        <div className="card">
          <div className="kpi">{hub.stats.assignmentsDueCount}</div>
          <div className="kpi-label">Assignments Due</div>
        </div>
        <div className="card">
          <div className="kpi">{hub.stats.waitlistedCount}</div>
          <div className="kpi-label">Waitlisted</div>
        </div>
      </div>

      {hub.nextSession && (
        <div
          className="card"
          style={{ marginBottom: 24, borderLeft: "4px solid var(--ypp-purple)" }}
        >
          <div style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 700 }}>
            Next Action
          </div>
          <h3 style={{ marginTop: 6 }}>{hub.nextSession.classTitle}</h3>
          <p style={{ marginTop: 4, color: "var(--text-secondary)" }}>
            {hub.nextSession.topic}
          </p>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              fontSize: 14,
              color: "var(--text-secondary)",
            }}
          >
            <span>
              {hub.nextSession.date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>
              {hub.nextSession.startTime} - {hub.nextSession.endTime}
            </span>
            <span>{hub.nextSession.instructorName}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Link href={`/curriculum/${hub.nextSession.offeringId}`} className="button secondary">
              Open Class
            </Link>
            {hub.nextSession.zoomLink && (
              <a
                href={hub.nextSession.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="button primary"
              >
                Join Session
              </a>
            )}
          </div>
        </div>
      )}

      {hub.activeClasses.length === 0 && hub.waitlistedClasses.length === 0 ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>No classes yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Start from your chapter, a pathway, or the full catalog. Every path now leads into the same student class experience.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <Link href="/my-chapter" className="button secondary">
              My Chapter
            </Link>
            <Link href="/pathways" className="button secondary">
              Pathways
            </Link>
            <Link href="/curriculum" className="button primary">
              Browse Classes
            </Link>
          </div>

          {hub.recommendedClasses.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="section-title">Recommended To Start</div>
              <div className="grid two" style={{ marginTop: 12 }}>
                {hub.recommendedClasses.map((offering) => {
                  const learnerFit = getLearnerFitSummary({
                    learnerFitLabel: offering.template.learnerFitLabel,
                    learnerFitDescription: offering.template.learnerFitDescription,
                    difficultyLevel: offering.template.difficultyLevel,
                  });

                  return (
                    <Link
                      key={offering.id}
                      href={`/curriculum/${offering.id}`}
                      className="card"
                      style={{ textDecoration: "none", color: "inherit" }}
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
                        {offering.reasonLabel ? (
                          <span className="pill pill-info">{offering.reasonLabel}</span>
                        ) : null}
                      </div>
                      <h4 style={{ marginTop: 0 }}>{offering.title}</h4>
                      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                        {offering.description.slice(0, 120)}
                        {offering.description.length > 120 ? "..." : ""}
                      </p>
                      <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                        <div>{offering.instructor.name}</div>
                        <div>
                          {offering.meetingDays.join(", ")} | {offering.meetingTime}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Assignments Due Soon</div>
          {hub.dueAssignments.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
              Nothing due right now. When instructors post class work, your next actions will show up here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {hub.dueAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/curriculum/${assignment.offeringId}/assignments/${assignment.id}`}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{assignment.title}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                        {assignment.offeringTitle}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12 }}>
                      <div
                        style={{
                          color: assignment.isOverdue ? "#dc2626" : "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {assignment.isOverdue ? "Overdue" : "Due"}
                      </div>
                      <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                        {assignment.dueAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Recent Class Updates</div>
          {hub.recentAnnouncements.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
              No class announcements yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {hub.recentAnnouncements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/curriculum/${announcement.offeringId}`}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    {announcement.isPinned ? (
                      <span className="pill pill-info">Pinned</span>
                    ) : null}
                    <span className="pill">{announcement.offeringTitle}</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{announcement.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {announcement.authorName} ·{" "}
                    {announcement.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {hub.waitlistedClasses.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Waitlist Updates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {hub.waitlistedClasses.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/curriculum/${enrollment.offering.id}`}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{enrollment.offering.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {enrollment.offering.chapterLabel ?? "Partner chapter class"}
                    </div>
                  </div>
                  <span
                    className="pill"
                    style={{ background: "#fffbeb", color: "#b45309", fontWeight: 700 }}
                  >
                    #{enrollment.waitlistPosition ?? "?"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {hub.activeClasses.length > 0 && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="section-title">Active Classes</div>
            <Link href="/curriculum/schedule" style={{ color: "var(--ypp-purple)" }}>
              Open full calendar →
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {hub.activeClasses.map((enrollment) => {
              const learnerFit = getLearnerFitSummary({
                learnerFitLabel: enrollment.offering.template.learnerFitLabel,
                learnerFitDescription: enrollment.offering.template.learnerFitDescription,
                difficultyLevel: enrollment.offering.template.difficultyLevel,
              });

              return (
                <Link
                  key={enrollment.id}
                  href={`/curriculum/${enrollment.offering.id}`}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
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
                        <span className="pill">{enrollment.offering.template.interestArea}</span>
                        {enrollment.offering.pathway ? (
                          <span className="pill pill-info">
                            Step {enrollment.offering.pathway.stepOrder} in {enrollment.offering.pathway.name}
                          </span>
                        ) : null}
                      </div>
                      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{enrollment.offering.title}</h3>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        <div>{enrollment.offering.instructor.name}</div>
                        <div style={{ marginTop: 4 }}>
                          {enrollment.offering.meetingDays.join(", ")} | {enrollment.offering.meetingTime}
                        </div>
                        {enrollment.offering.chapterLabel ? (
                          <div style={{ marginTop: 4 }}>{enrollment.offering.chapterLabel}</div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ minWidth: 180 }}>
                      {enrollment.offering.nextSession ? (
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "var(--ypp-purple-50)",
                            color: "var(--ypp-purple-800)",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>Next session</div>
                          <div style={{ marginTop: 4 }}>
                            {enrollment.offering.nextSession.date.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at {enrollment.offering.nextSession.startTime}
                          </div>
                          <div style={{ marginTop: 4 }}>{enrollment.offering.nextSession.topic}</div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "var(--gray-100)",
                            color: "var(--text-secondary)",
                            fontSize: 13,
                          }}
                        >
                          Upcoming sessions will appear here once the class schedule is active.
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
