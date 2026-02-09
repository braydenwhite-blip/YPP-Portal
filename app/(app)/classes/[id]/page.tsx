import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClassOfferingDetail } from "@/lib/class-management-actions";
import Link from "next/link";
import { ClassDetailClient } from "./client";

const difficultyLabels: Record<string, string> = {
  LEVEL_101: "101 - Beginner",
  LEVEL_201: "201 - Intermediate",
  LEVEL_301: "301 - Advanced",
  LEVEL_401: "401 - Expert",
};

const difficultyColors: Record<string, string> = {
  LEVEL_101: "#22c55e",
  LEVEL_201: "#3b82f6",
  LEVEL_301: "#f59e0b",
  LEVEL_401: "#ef4444",
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const offering = await getClassOfferingDetail(id);

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
          <Link href="/classes/catalog" className="button primary" style={{ marginTop: 16 }}>
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
  const upcomingSessions = offering.sessions.filter(
    (s) => new Date(s.date) >= new Date() && !s.isCancelled
  );
  const pastSessions = offering.sessions.filter(
    (s) => new Date(s.date) < new Date() || s.isCancelled
  );

  const completionPct = offering.template.learningOutcomes.length > 0 && myEnrollment
    ? Math.round(((myEnrollment.outcomesAchieved?.length || 0) / offering.template.learningOutcomes.length) * 100)
    : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/classes/catalog" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Back to Catalog
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{offering.title}</h1>
        </div>
        {isInstructor && (
          <Link
            href={`/instructor/class-settings?offering=${offering.id}`}
            className="button secondary"
          >
            Manage Class
          </Link>
        )}
      </div>

      {/* Class Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
              {offering.template.description}
            </p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <span className="pill" style={{
                background: (difficultyColors[offering.template.difficultyLevel] || "#888") + "18",
                color: difficultyColors[offering.template.difficultyLevel],
                fontWeight: 600,
              }}>
                {difficultyLabels[offering.template.difficultyLevel]}
              </span>
              <span className="pill">{offering.template.interestArea}</span>
              <span className="pill">{offering.deliveryMode.replace("_", " ")}</span>
              <span className="pill">{offering.status.replace("_", " ")}</span>
              {offering.semester && <span className="pill">{offering.semester}</span>}
            </div>

            <div style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div><strong>Instructor:</strong> {offering.instructor.name}</div>
              <div>
                <strong>Schedule:</strong>{" "}
                {offering.meetingDays.join(", ")} | {offering.meetingTime}
              </div>
              <div>
                <strong>Dates:</strong>{" "}
                {new Date(offering.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                {" - "}
                {new Date(offering.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <div><strong>Duration:</strong> {offering.template.durationWeeks} weeks ({offering.sessions.length} sessions)</div>
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
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {spotsLeft > 0 ? `${spotsLeft} spots remaining` : "Class is full"}
            </div>

            <ClassDetailClient
              offeringId={offering.id}
              isEnrolled={isEnrolled}
              isWaitlisted={isWaitlisted}
              isFull={spotsLeft <= 0}
              isInstructor={isInstructor}
              enrollmentOpen={offering.enrollmentOpen}
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
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      {offering.template.prerequisites.length > 0 && (
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Session {s.sessionNumber}: {s.topic}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" | "}
                        {s.startTime} - {s.endTime}
                      </div>
                    </div>
                    {s.milestone && (
                      <span className="pill" style={{ fontSize: 11 }}>
                        {s.milestone}
                      </span>
                    )}
                  </div>
                  {s.learningOutcomes.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Goals: {s.learningOutcomes.join(", ")}
                    </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Session {s.sessionNumber}: {s.topic}
                        {s.isCancelled && <span style={{ color: "#ef4444" }}> (Cancelled)</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {s._count.attendance} attended
                    </div>
                  </div>
                  {s.recordingUrl && (
                    <a
                      href={s.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 4, display: "inline-block" }}
                    >
                      Watch Recording
                    </a>
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
                  <th>Email</th>
                  <th>Sessions Attended</th>
                  <th>Outcomes Achieved</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td style={{ fontWeight: 500 }}>{enrollment.student.name}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{enrollment.student.email}</td>
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
