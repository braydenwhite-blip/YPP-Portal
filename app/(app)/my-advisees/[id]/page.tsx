// Advising workspace for one student — the advisor's (or an admin's) view of
// the student's interests, classes, and activity, plus the advising controls:
// check-ins/notes, advising status, follow-up flag, next steps, and
// recommended opportunities.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { isLeadershipRolesEnabled } from "@/lib/feature-flags";
import { loadAdvisingAssignmentDetail } from "@/lib/leadership/queries";
import { AdvisingStatusPill, formatLeadershipDate } from "@/components/leadership/ui";
import {
  AdvisingNoteComposer,
  AdvisingStatusSelect,
  EndAssignmentButton,
  FollowUpToggle,
  NextStepsEditor,
  RecommendationComposer,
  RecommendationStatusButtons,
} from "@/components/leadership/advising-controls";
import {
  RECOMMENDATION_KIND_LABELS,
  type RecommendationKind,
} from "@/lib/leadership/constants";

export const dynamic = "force-dynamic";

export default async function AdvisingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isLeadershipRolesEnabled()) redirect("/");
  const { id } = await params;
  const session = await getSession();
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];
  if (!userId) redirect("/");

  const assignment = await loadAdvisingAssignmentDetail(id);
  if (!assignment) notFound();

  const isAdmin = roles.includes("ADMIN");
  if (!isAdmin && assignment.advisorId !== userId) redirect("/my-advisees");

  const { student } = assignment;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="badge">Advising</p>
          <h1 className="page-title">{student.name}</h1>
          <p className="page-subtitle">
            {student.email} · {student.chapter?.name ?? "No chapter"}
            {student.profile?.grade ? ` · Grade ${student.profile.grade}` : ""}
            {student.profile?.school ? ` · ${student.profile.school}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href={isAdmin ? "/admin/leadership" : "/my-advisees"} className="button secondary">
            Back
          </Link>
          {isAdmin && <EndAssignmentButton assignmentId={assignment.id} />}
        </div>
      </div>

      {!assignment.isActive && (
        <div className="card" style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
          <strong style={{ fontSize: 13, color: "#991b1b" }}>
            This assignment ended {formatLeadershipDate(assignment.endedAt)}.
          </strong>
        </div>
      )}

      <div className="instructor-profile-two-column" style={{ marginTop: 16, alignItems: "start" }}>
        {/* Left: student snapshot */}
        <div style={{ display: "grid", gap: 12 }}>
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Student snapshot</h3>
            <p style={{ fontSize: 13, margin: "0 0 8px" }}>
              <strong>Interests:</strong>{" "}
              {student.profile?.interests?.length
                ? student.profile.interests.join(", ")
                : "None recorded"}
            </p>
            {student.profile?.primaryGoal && (
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                <strong>Goal:</strong> {student.profile.primaryGoal}
              </p>
            )}
            {student.menteePairs.length > 0 && (
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                <strong>Mentor:</strong>{" "}
                {student.menteePairs.map((pair) => pair.mentor.name).join(", ")}
              </p>
            )}
            <p style={{ fontSize: 13, margin: 0 }}>
              <strong>Member since:</strong> {formatLeadershipDate(student.createdAt)}
            </p>

            <h4 style={{ margin: "12px 0 6px", fontSize: 13 }}>Recent classes</h4>
            {student.classEnrollments.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
                No class enrollments yet.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 2 }}>
                {student.classEnrollments.map((enrollment) => (
                  <li key={enrollment.id}>
                    {enrollment.offering.title}{" "}
                    <span style={{ color: "var(--muted, #6b7280)" }}>
                      · {enrollment.status.toLowerCase()} · {formatLeadershipDate(enrollment.enrolledAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Next steps</h3>
            <NextStepsEditor assignmentId={assignment.id} nextSteps={assignment.nextSteps} />
          </section>

          <section className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Recommended opportunities</h3>
              <RecommendationComposer assignmentId={assignment.id} />
            </div>
            {assignment.recommendations.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: "8px 0 0" }}>
                Recommend a class, project, mentor, or opportunity to give this student a concrete
                next step.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {assignment.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}
                  >
                    <div style={{ fontSize: 13 }}>
                      <span className="pill pill-small pill-info" style={{ marginRight: 6 }}>
                        {RECOMMENDATION_KIND_LABELS[rec.kind as RecommendationKind] ?? rec.kind}
                      </span>
                      <strong>{rec.title}</strong>
                      {rec.detail && (
                        <div style={{ color: "var(--muted, #6b7280)" }}>{rec.detail}</div>
                      )}
                    </div>
                    <RecommendationStatusButtons recommendationId={rec.id} status={rec.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: advising state + notes */}
        <div style={{ display: "grid", gap: 12 }}>
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Advising status</h3>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <AdvisingStatusPill status={assignment.advisingStatus} />
              <AdvisingStatusSelect assignmentId={assignment.id} status={assignment.advisingStatus} />
            </div>
            <div style={{ marginTop: 10 }}>
              <FollowUpToggle
                assignmentId={assignment.id}
                needsFollowUp={assignment.needsFollowUp}
                followUpNote={assignment.followUpNote}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: "10px 0 0" }}>
              Advisor: {assignment.advisor.name} · Assigned {formatLeadershipDate(assignment.startDate)} ·
              Last check-in:{" "}
              {assignment.lastCheckInAt ? formatLeadershipDate(assignment.lastCheckInAt) : "never"}
            </p>
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Log a check-in or note</h3>
            <AdvisingNoteComposer assignmentId={assignment.id} />

            <h4 style={{ margin: "14px 0 6px", fontSize: 13 }}>History</h4>
            {assignment.notes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
                No notes or check-ins yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {assignment.notes.map((note) => (
                  <div key={note.id} style={{ fontSize: 12, borderLeft: "2px solid #e5e7eb", paddingLeft: 8 }}>
                    <strong>{note.kind === "CHECK_IN" ? "Check-in" : "Note"}</strong> ·{" "}
                    {note.author.name} · {formatLeadershipDate(note.createdAt)}
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{note.body}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
