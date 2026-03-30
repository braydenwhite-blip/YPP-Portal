import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getIncubatorProject, getProjectResourceRequests } from "@/lib/incubator-actions";
import { normalizeRoleSet } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  LaunchStudioForm,
  PitchFeedbackForm,
  PostUpdateForm,
  SubmitMilestoneForm,
  ApproveMilestoneButton,
  SubmitLaunchButton,
  ApproveLaunchButton,
  ResourceRequestForm,
} from "./client";
import {
  INCUBATOR_PHASE_COLORS,
  INCUBATOR_PHASE_DESCRIPTIONS,
  INCUBATOR_PHASE_LABELS,
  INCUBATOR_PHASES,
} from "@/lib/incubator-workflow";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "TBD";
  return new Date(value).toLocaleDateString();
}

function phaseColorFor(phase: string | null | undefined) {
  if (!phase) return "#0f172a";
  return INCUBATOR_PHASE_COLORS[phase as keyof typeof INCUBATOR_PHASE_COLORS] || "#0f172a";
}

function phaseLabelFor(phase: string | null | undefined) {
  if (!phase) return "Unknown";
  return INCUBATOR_PHASE_LABELS[phase as keyof typeof INCUBATOR_PHASE_LABELS] || phase;
}

export default async function IncubatorProjectPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [project, resourceRequests] = await Promise.all([
    getIncubatorProject(params.id),
    getProjectResourceRequests(params.id),
  ]);

  if (!project) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Project Not Found</h1></div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>This project does not exist.</p>
          <Link href="/incubator" className="button secondary" style={{ marginTop: 12 }}>Back to Incubator</Link>
        </div>
      </div>
    );
  }

  const passionLabel = project.passionId
    ? (await prisma.passionArea
        .findUnique({
          where: { id: project.passionId },
          select: { name: true },
        })
        .then((passion) => passion?.name ?? null)
        .catch(() => null)) ?? project.passionArea
    : project.passionArea;

  const isOwner = project.studentId === session.user.id;
  const roleSet = normalizeRoleSet(
    (session.user as any).roles ?? [],
    (session.user as any).primaryRole ?? null
  );
  const isAdmin = roleSet.has("ADMIN");
  const isInstructor = roleSet.has("INSTRUCTOR");
  const isChapterLead = roleSet.has("CHAPTER_PRESIDENT");
  const isMentor = project.mentors.some((mentor) => mentor.mentorId === session.user.id);
  const canReview = !isOwner && (isAdmin || isInstructor || isChapterLead || isMentor);
  const phaseIndex = INCUBATOR_PHASES.indexOf(project.currentPhase);
  const phaseColor = phaseColorFor(project.currentPhase);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{project.title}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            by {project.student.name} · {project.cohort.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {project.launchStatus === "APPROVED" && project.publicSlug && (
            <Link href={`/incubator/launches/${project.publicSlug}`} className="button secondary">
              View Public Launch
            </Link>
          )}
          <Link href="/incubator" className="button secondary">Back to Incubator</Link>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 24,
          background: `linear-gradient(135deg, ${phaseColor}18 0%, rgba(255,255,255,1) 55%)`,
          border: `1px solid ${phaseColor}33`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="pill" style={{ background: `${phaseColor}18`, color: phaseColor, fontWeight: 700 }}>
                {phaseLabelFor(project.currentPhase)}
              </span>
              <span className="pill">{passionLabel || "General"}</span>
              <span className="pill">
                Launch: {project.launchStatus.toLowerCase().replace(/_/g, " ")}
              </span>
            </div>
            <h2 style={{ margin: "0 0 8px" }}>Milestone studio</h2>
            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, margin: 0 }}>
              {INCUBATOR_PHASE_DESCRIPTIONS[project.currentPhase]}
            </p>
            {project.nextMilestone && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(15,23,42,0.08)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>
                  Next milestone
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{project.nextMilestone.title}</div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                  {project.nextMilestone.description}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  Due {formatDate(project.nextMilestone.dueDate)}
                </div>
              </div>
            )}
          </div>

          <div style={{ minWidth: 280, maxWidth: 320, display: "grid", gap: 10 }}>
            <div className="card" style={{ margin: 0, background: "rgba(255,255,255,0.88)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
                Phase progress
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: phaseColor }}>
                {project.currentPhaseProgress.percent}%
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                {project.currentPhaseProgress.completed} of {project.currentPhaseProgress.total} required milestones complete
              </div>
            </div>

            <div
              className="card"
              style={{
                margin: 0,
                background: project.mentorBlocked ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${project.mentorBlocked ? "#fecaca" : "#bbf7d0"}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
                Mentor state
              </div>
              <div style={{ fontSize: 13, color: project.mentorBlocked ? "#991b1b" : "#166534", lineHeight: 1.6 }}>
                {project.mentorBlocked
                  ? "A mentor must be assigned before the studio can move cleanly through the next phase."
                  : `${project.activeMentorCount} mentor(s) are attached to this project.`}
              </div>
            </div>

            <div
              className="card"
              style={{
                margin: 0,
                background: project.needsWeeklyCheckIn ? "#fff7ed" : "#eff6ff",
                border: `1px solid ${project.needsWeeklyCheckIn ? "#fed7aa" : "#bfdbfe"}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
                Weekly rhythm
              </div>
              <div style={{ fontSize: 13, color: project.needsWeeklyCheckIn ? "#9a3412" : "#1d4ed8", lineHeight: 1.6 }}>
                {project.needsWeeklyCheckIn
                  ? "A fresh update is due. Posting one helps mentors and staff keep the launch on track."
                  : "The project has a recent update and is staying visible."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          {INCUBATOR_PHASES.map((phase, index) => {
            const color = INCUBATOR_PHASE_COLORS[phase];
            const complete = index < phaseIndex;
            const current = index === phaseIndex;
            return (
              <div key={phase} style={{ flex: 1 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: complete ? color : current ? `${color}80` : "var(--gray-200)",
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontSize: 10, color: current ? color : "var(--text-secondary)", textAlign: "center", fontWeight: current ? 700 : 500 }}>
                  {phaseLabelFor(phase)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>About the project</h3>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: 0 }}>{project.description}</p>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="topbar" style={{ marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>Phase Milestones</h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                  These checkpoints now control how the project moves through the incubator.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {project.milestones.map((milestone) => {
                const milestoneColor =
                  milestone.status === "APPROVED"
                    ? "#15803d"
                    : milestone.status === "SUBMITTED"
                      ? "#d97706"
                      : milestone.phase === project.currentPhase
                        ? phaseColor
                        : "#94a3b8";
                return (
                  <div
                    key={milestone.id}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: `1px solid ${milestoneColor}33`,
                      background: milestone.phase === project.currentPhase ? `${milestoneColor}0f` : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                          <span className="pill" style={{ background: `${milestoneColor}18`, color: milestoneColor, fontWeight: 700 }}>
                            {phaseLabelFor(milestone.phase)}
                          </span>
                          <span className="pill">
                            {milestone.status.toLowerCase().replace(/_/g, " ")}
                          </span>
                          {milestone.requiresMentorApproval && (
                            <span className="pill">Mentor approval required</span>
                          )}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{milestone.title}</div>
                        {milestone.description && (
                          <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.6 }}>
                            {milestone.description}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginTop: 8 }}>
                          <span>Due {formatDate(milestone.dueDate)}</span>
                          {milestone.deliverableLabel && <span>Deliverable: {milestone.deliverableLabel}</span>}
                        </div>
                        {milestone.submissionNote && (
                          <div style={{ fontSize: 13, color: "#334155", marginTop: 8, lineHeight: 1.6 }}>
                            <strong>Latest submission:</strong> {milestone.submissionNote}
                          </div>
                        )}
                        {milestone.artifactUrls.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {milestone.artifactUrls.map((url: string, index: number) => (
                              <a key={`${milestone.id}-${index}`} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                                Artifact {index + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 250 }}>
                        {isOwner && milestone.status !== "APPROVED" && (
                          <SubmitMilestoneForm
                            projectId={project.id}
                            milestoneId={milestone.id}
                            requiresMentorApproval={milestone.requiresMentorApproval}
                          />
                        )}
                        {canReview && milestone.status === "SUBMITTED" && (
                          <ApproveMilestoneButton projectId={project.id} milestoneId={milestone.id} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isOwner && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Weekly progress update</h3>
              <PostUpdateForm projectId={project.id} currentPhase={project.currentPhase} />
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="topbar" style={{ marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>Launch Studio</h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                  Shape the public story and launch assets that can become the approved project page.
                </p>
              </div>
              {project.launchStatus === "APPROVED" && project.publicSlug && (
                <Link href={`/incubator/launches/${project.publicSlug}`} className="button secondary small">
                  Open Launch Page
                </Link>
              )}
            </div>
            {(isOwner || canReview) ? (
              <LaunchStudioForm project={project as any} isOwner={isOwner} />
            ) : (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Launch details become visible here for the student and assigned reviewers.
              </p>
            )}
            {isOwner && (
              <div style={{ marginTop: 12 }}>
                <SubmitLaunchButton projectId={project.id} launchStatus={project.launchStatus} />
              </div>
            )}
            {canReview && project.launchStatus === "SUBMITTED" && (
              <div style={{ marginTop: 12 }}>
                <ApproveLaunchButton projectId={project.id} />
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Updates ({project.updates.length})</h3>
            {project.updates.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {project.updates.map((update: any) => {
                  const updateColor = phaseColorFor(update.phase);
                  return (
                    <div key={update.id} style={{ padding: 14, borderRadius: 16, border: `1px solid ${updateColor}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="pill" style={{ background: `${updateColor}15`, color: updateColor }}>
                            {phaseLabelFor(update.phase)}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{update.author.name}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{formatDate(update.createdAt)}</span>
                      </div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{update.title}</div>
                      <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {update.content}
                      </p>
                      {(update.hoursSpent != null || update.mediaUrls?.length > 0) && (
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginTop: 8 }}>
                          {update.hoursSpent != null && <span>{update.hoursSpent} hours logged</span>}
                          {update.mediaUrls?.length > 0 &&
                            update.mediaUrls.map((url: string, index: number) => (
                              <a key={`${update.id}-${index}`} href={url} target="_blank" rel="noopener noreferrer">
                                Attachment {index + 1}
                              </a>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                No updates yet. {isOwner ? "Post the first one above to keep the studio moving." : "Check back soon."}
              </p>
            )}
          </div>

          {(project.currentPhase === "FEEDBACK" || project.currentPhase === "POLISHING" || project.currentPhase === "SHOWCASE") && (
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Pitch Feedback ({project.pitchFeedback.length})</h3>
              {!isOwner && canReview && (
                <div style={{ marginBottom: 16 }}>
                  <PitchFeedbackForm projectId={project.id} />
                </div>
              )}
              {project.pitchFeedback.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {project.pitchFeedback.map((feedback: any) => (
                    <div key={feedback.id} style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                        <strong>{feedback.reviewer.name}</strong>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{formatDate(feedback.createdAt)}</span>
                      </div>
                      {feedback.overallScore && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                          {feedback.clarityScore && <span className="pill">Clarity {feedback.clarityScore}/5</span>}
                          {feedback.passionScore && <span className="pill">Passion {feedback.passionScore}/5</span>}
                          {feedback.executionScore && <span className="pill">Execution {feedback.executionScore}/5</span>}
                          {feedback.impactScore && <span className="pill">Impact {feedback.impactScore}/5</span>}
                          <span className="pill" style={{ background: "#dcfce7", color: "#15803d" }}>
                            Overall {feedback.overallScore}/5
                          </span>
                        </div>
                      )}
                      {feedback.strengths && <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Strengths:</strong> {feedback.strengths}</div>}
                      {feedback.improvements && <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Improvements:</strong> {feedback.improvements}</div>}
                      {feedback.encouragement && <div style={{ fontSize: 13, color: "#166534" }}>{feedback.encouragement}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>No feedback yet.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Mentors</h4>
            {project.mentors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {project.mentors.map((mentor: any) => (
                  <div key={mentor.id} style={{ paddingBottom: 10, borderBottom: "1px solid var(--gray-200)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{mentor.mentor.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{mentor.role}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                No mentor assigned yet.
              </p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Launch Status</h4>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
              <div><strong>Status:</strong> {project.launchStatus.toLowerCase().replace(/_/g, " ")}</div>
              <div><strong>Launch title:</strong> {project.launchTitle || "Not drafted yet"}</div>
              <div><strong>Target audience:</strong> {project.targetAudience || "Not set yet"}</div>
              <div><strong>Showcase date:</strong> {formatDate(project.cohort.showcaseDate)}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Resource Requests</h4>
            {isOwner && <ResourceRequestForm projectId={project.id} />}
            {(resourceRequests as any[]).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {(resourceRequests as any[]).map((request) => (
                  <div key={request.id} style={{ padding: 12, borderRadius: 14, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700 }}>{request.itemName}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{request.status}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{request.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: isOwner ? "12px 0 0" : 0 }}>
                No resource requests yet.
              </p>
            )}
          </div>

          <div className="card">
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Project Info</h4>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
              <div><strong>Student:</strong> {project.student.name}</div>
              <div><strong>Level:</strong> {project.student.level}</div>
              <div><strong>Passion:</strong> {passionLabel || "General"}</div>
              <div><strong>XP earned:</strong> {project.xpEarned}</div>
              <div><strong>Started:</strong> {formatDate(project.createdAt)}</div>
              <div><strong>Public slug:</strong> {project.publicSlug || "Not public yet"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
