import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getIncubatorProject } from "@/lib/incubator-actions";
import Link from "next/link";
import {
  AdvancePhaseButton,
  PostUpdateForm,
  PitchFeedbackForm,
  ShowcaseLinksForm,
} from "./client";

const PHASE_LABELS: Record<string, string> = {
  IDEATION: "Ideation", PLANNING: "Planning", BUILDING: "Building",
  FEEDBACK: "Feedback", POLISHING: "Polishing", SHOWCASE: "Showcase",
};
const PHASE_COLORS: Record<string, string> = {
  IDEATION: "#8b5cf6", PLANNING: "#3b82f6", BUILDING: "#d97706",
  FEEDBACK: "#ec4899", POLISHING: "#06b6d4", SHOWCASE: "#16a34a",
};
const PHASE_DESCRIPTIONS: Record<string, string> = {
  IDEATION: "Brainstorm, research, and define what your project will be.",
  PLANNING: "Set milestones, gather resources, and connect with your mentor.",
  BUILDING: "Do the work! Create, practice, build, and document your progress.",
  FEEDBACK: "Share your work and get feedback from peers and mentors.",
  POLISHING: "Refine your project based on feedback. Prepare for showcase.",
  SHOWCASE: "Present your project to the community. You made it!",
};
const PHASES = ["IDEATION", "PLANNING", "BUILDING", "FEEDBACK", "POLISHING", "SHOWCASE"];

export default async function IncubatorProjectPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const project = await getIncubatorProject(params.id);
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

  const isOwner = project.studentId === session.user.id;
  const isAdmin = (session.user as any).primaryRole === "ADMIN";
  const isInstructor = (session.user as any).primaryRole === "INSTRUCTOR";
  const isMentor = project.mentors.some((m) => m.mentorId === session.user.id);
  const phaseIdx = PHASES.indexOf(project.currentPhase);
  const color = PHASE_COLORS[project.currentPhase];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{project.title}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            by {project.student.name} &middot; {project.cohort.name}
          </p>
        </div>
        <Link href="/incubator" className="button secondary">Back to Incubator</Link>
      </div>

      {/* Phase Progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <span className="pill" style={{ background: `${color}15`, color, fontWeight: 600, fontSize: 13 }}>
              {PHASE_LABELS[project.currentPhase]} Phase
            </span>
            <span className="pill" style={{ fontSize: 11, marginLeft: 8 }}>{project.passionArea}</span>
          </div>
          {isOwner && phaseIdx < PHASES.length - 1 && (
            <AdvancePhaseButton projectId={project.id} nextPhase={PHASES[phaseIdx + 1]} />
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
          {PHASE_DESCRIPTIONS[project.currentPhase]}
        </p>
        {/* Phase Steps */}
        <div style={{ display: "flex", gap: 4 }}>
          {PHASES.map((phase, i) => {
            const isComplete = i < phaseIdx;
            const isCurrent = i === phaseIdx;
            const phColor = PHASE_COLORS[phase];
            return (
              <div key={phase} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: 8, borderRadius: 4, marginBottom: 6,
                  background: isComplete ? phColor : isCurrent ? `${phColor}80` : "var(--gray-200)",
                }} />
                <div style={{
                  fontSize: 10,
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? phColor : "var(--text-secondary)",
                }}>
                  {PHASE_LABELS[phase]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        {/* Main Column */}
        <div>
          {/* Project Description */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>About This Project</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {project.description}
            </p>
          </div>

          {/* Showcase Links (if in polishing/showcase phase) */}
          {isOwner && (project.currentPhase === "POLISHING" || project.currentPhase === "SHOWCASE") && (
            <div className="card" style={{ marginBottom: 16, border: "2px solid #16a34a" }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Showcase Materials</h3>
              {project.pitchVideoUrl && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Pitch Video: <a href={project.pitchVideoUrl} target="_blank" rel="noopener noreferrer">{project.pitchVideoUrl}</a>
                </div>
              )}
              {project.pitchDeckUrl && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Pitch Deck: <a href={project.pitchDeckUrl} target="_blank" rel="noopener noreferrer">{project.pitchDeckUrl}</a>
                </div>
              )}
              {project.finalShowcaseUrl && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Final Showcase: <a href={project.finalShowcaseUrl} target="_blank" rel="noopener noreferrer">{project.finalShowcaseUrl}</a>
                </div>
              )}
              <ShowcaseLinksForm
                projectId={project.id}
                initialPitchVideo={project.pitchVideoUrl || ""}
                initialPitchDeck={project.pitchDeckUrl || ""}
                initialShowcase={project.finalShowcaseUrl || ""}
              />
            </div>
          )}

          {/* Post Update */}
          {isOwner && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Post an Update</h3>
              <PostUpdateForm projectId={project.id} currentPhase={project.currentPhase} />
            </div>
          )}

          {/* Updates Feed */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Updates ({project.updates.length})</h3>
            {project.updates.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {project.updates.map((update: any) => {
                  const uColor = PHASE_COLORS[update.phase] || "#6b7280";
                  return (
                    <div key={update.id} className="card" style={{ borderLeft: `3px solid ${uColor}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="pill" style={{ background: `${uColor}15`, color: uColor, fontSize: 10 }}>
                            {PHASE_LABELS[update.phase]}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{update.author.name}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {new Date(update.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 style={{ margin: "0 0 4px" }}>{update.title}</h4>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap" }}>
                        {update.content}
                      </p>
                      {update.hoursSpent != null && (
                        <div style={{ fontSize: 12, color: "#d97706", marginTop: 6 }}>
                          {update.hoursSpent} hours spent
                        </div>
                      )}
                      {update.mediaUrls?.length > 0 && (
                        <div style={{ fontSize: 12, marginTop: 6 }}>
                          {update.mediaUrls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8 }}>
                              Attachment {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card">
                <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
                  No updates yet. {isOwner ? "Post your first update above!" : "Check back soon!"}
                </p>
              </div>
            )}
          </div>

          {/* Pitch Feedback */}
          {(project.currentPhase === "FEEDBACK" || project.currentPhase === "POLISHING" || project.currentPhase === "SHOWCASE") && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                Pitch Feedback ({project.pitchFeedback.length})
              </h3>
              {!isOwner && (isAdmin || isInstructor || isMentor) && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginBottom: 8 }}>Give Feedback</h4>
                  <PitchFeedbackForm projectId={project.id} />
                </div>
              )}
              {project.pitchFeedback.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {project.pitchFeedback.map((fb: any) => (
                    <div key={fb.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{fb.reviewer.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {new Date(fb.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {fb.overallScore && (
                        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                          {fb.clarityScore && <span className="pill" style={{ fontSize: 11 }}>Clarity: {fb.clarityScore}/5</span>}
                          {fb.passionScore && <span className="pill" style={{ fontSize: 11 }}>Passion: {fb.passionScore}/5</span>}
                          {fb.executionScore && <span className="pill" style={{ fontSize: 11 }}>Execution: {fb.executionScore}/5</span>}
                          {fb.impactScore && <span className="pill" style={{ fontSize: 11 }}>Impact: {fb.impactScore}/5</span>}
                          <span className="pill" style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>
                            Overall: {fb.overallScore}/5
                          </span>
                        </div>
                      )}
                      {fb.strengths && (
                        <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Strengths:</strong> {fb.strengths}</div>
                      )}
                      {fb.improvements && (
                        <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Areas to improve:</strong> {fb.improvements}</div>
                      )}
                      {fb.encouragement && (
                        <div style={{ fontSize: 13, color: "#16a34a" }}>{fb.encouragement}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
                    No feedback yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Mentors */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginBottom: 8 }}>Mentors</h4>
            {project.mentors.length > 0 ? (
              project.mentors.map((m: any) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--gray-200)" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.mentor.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.role}</div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>No mentor assigned yet.</p>
            )}
          </div>

          {/* Project Info */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ marginBottom: 8 }}>Project Info</h4>
            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Student:</strong> {project.student.name}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Level:</strong> {project.student.level}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Passion:</strong> {project.passionArea}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Cohort:</strong> {project.cohort.name}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>XP Earned:</strong> {project.xpEarned}</div>
            <div style={{ fontSize: 13 }}><strong>Started:</strong> {new Date(project.createdAt).toLocaleDateString()}</div>
          </div>

          {/* Phase Checklist */}
          <div className="card">
            <h4 style={{ marginBottom: 8 }}>Phase Checklist</h4>
            {PHASES.map((phase) => {
              const complete = (project as any)[`${phase.toLowerCase()}Complete`];
              const isCurrent = phase === project.currentPhase;
              return (
                <div
                  key={phase}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--gray-200)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  <span style={{ color: complete ? "#16a34a" : "var(--text-secondary)" }}>
                    {complete ? "■" : "□"}
                  </span>
                  <span style={{
                    fontSize: 13,
                    color: isCurrent ? PHASE_COLORS[phase] : complete ? "inherit" : "var(--text-secondary)",
                  }}>
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
