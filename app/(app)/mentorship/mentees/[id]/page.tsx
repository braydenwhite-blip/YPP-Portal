import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GoalProgressDisplay } from "@/components/progress-bar";

export default async function MenteeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menteeId } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
  }

  // Verify mentor has access to this mentee
  if (!isAdmin) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: userId,
        menteeId,
        status: "ACTIVE"
      }
    });

    if (!mentorship) {
      redirect("/mentorship/mentees");
    }
  }

  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    include: {
      roles: true,
      chapter: true,
      profile: true,
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            include: {
              submittedBy: { select: { name: true } }
            }
          }
        },
        orderBy: { template: { sortOrder: "asc" } }
      },
      reflectionSubmissions: {
        include: {
          form: true,
          responses: {
            include: {
              question: true
            }
          }
        },
        orderBy: { submittedAt: "desc" },
        take: 3
      },
      courses: true,
      trainings: {
        include: { module: true }
      },
      approvals: {
        include: { levels: true }
      }
    }
  });

  if (!mentee) {
    notFound();
  }

  const goalsForDisplay = mentee.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    timetable: goal.timetable,
    latestStatus: goal.progress[0]?.status ?? null
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship/mentees" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Mentees
          </Link>
          <h1 className="page-title">{mentee.name}</h1>
        </div>
        <Link
          href={`/mentorship/feedback/${menteeId}`}
          className="button small secondary"
          style={{ textDecoration: "none" }}
        >
          Submit Feedback
        </Link>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="section-title">Profile</div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Email:</strong> {mentee.email}
            </p>
            {mentee.phone && (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Phone:</strong> {mentee.phone}
              </p>
            )}
            <p style={{ margin: "0 0 4px" }}>
              <strong>Role:</strong> {mentee.primaryRole.replace("_", " ")}
            </p>
            {mentee.chapter && (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Chapter:</strong> {mentee.chapter.name}
              </p>
            )}
          </div>
          {mentee.profile?.bio && (
            <div style={{ marginTop: 16 }}>
              <strong>Bio:</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{mentee.profile.bio}</p>
            </div>
          )}
          {mentee.profile?.curriculumUrl && (
            <div style={{ marginTop: 12 }}>
              <a href={mentee.profile.curriculumUrl} target="_blank" className="link">
                View Curriculum &rarr;
              </a>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Training & Approvals</div>
          {mentee.trainings.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No training assignments.</p>
          ) : (
            <div className="timeline">
              {mentee.trainings.map((training) => (
                <div key={training.id} className="timeline-item">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{training.module.title}</strong>
                    <span
                      className={`pill ${
                        training.status === "COMPLETE"
                          ? "pill-success"
                          : training.status === "IN_PROGRESS"
                          ? ""
                          : "pill-declined"
                      }`}
                    >
                      {training.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {mentee.approvals.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong>Approved Levels:</strong>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                {mentee.approvals[0].levels.map((level) => (
                  <span key={level.id} className={`pill level-${level.level.replace("LEVEL_", "").toLowerCase()}`}>
                    {level.level.replace("LEVEL_", "")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Progress Update</div>
        {mentee.goals.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No goals assigned to this mentee yet.</p>
        ) : (
          <>
            <GoalProgressDisplay goals={goalsForDisplay} showOverall={true} />

            <div style={{ marginTop: 32 }}>
              <h4 style={{ margin: "0 0 16px" }}>Goal Details & Comments</h4>
              {mentee.goals.map((goal, index) => (
                <div
                  key={goal.id}
                  style={{
                    padding: 16,
                    marginBottom: 16,
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong>
                        Goal {index + 1}: {goal.template.title}
                      </strong>
                      {goal.timetable && (
                        <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>
                          (By {goal.timetable})
                        </span>
                      )}
                    </div>
                  </div>
                  {goal.template.description && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                      {goal.template.description}
                    </p>
                  )}

                  {goal.progress.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <strong style={{ fontSize: 13 }}>Progress History:</strong>
                      <div style={{ marginTop: 8 }}>
                        {goal.progress.slice(0, 3).map((update) => (
                          <div
                            key={update.id}
                            style={{
                              padding: 12,
                              marginTop: 8,
                              background: "white",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span
                                className={`pill ${
                                  update.status === "ON_TRACK"
                                    ? "pill-success"
                                    : update.status === "BEHIND_SCHEDULE"
                                    ? "pill-pending"
                                    : update.status === "ABOVE_AND_BEYOND"
                                    ? "pill-pathway"
                                    : ""
                                }`}
                              >
                                {update.status.replace(/_/g, " ")}
                              </span>
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                {new Date(update.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {update.comments && (
                              <p style={{ margin: "8px 0 0", fontSize: 13 }}>{update.comments}</p>
                            )}
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                              By {update.submittedBy.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {mentee.reflectionSubmissions.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="section-title">Recent Reflections</div>
          <div className="timeline">
            {mentee.reflectionSubmissions.map((submission) => {
              const happinessResponse = submission.responses.find(
                (r) => r.question.type === "RATING_1_5"
              );

              return (
                <div key={submission.id} className="timeline-item">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{submission.form.title}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(submission.month).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                  {happinessResponse && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 13 }}>Happiness: </span>
                      <strong>{happinessResponse.value}/5</strong>
                    </div>
                  )}
                  <div style={{ marginTop: 12 }}>
                    {submission.responses
                      .filter((r) => r.question.type !== "RATING_1_5")
                      .slice(0, 2)
                      .map((response) => (
                        <div key={response.id} style={{ marginTop: 8 }}>
                          <strong style={{ fontSize: 12, color: "var(--muted)" }}>
                            {response.question.question}
                          </strong>
                          <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                            {response.value.slice(0, 150)}
                            {response.value.length > 150 ? "..." : ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
