import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServiceProjectDetail } from "@/lib/real-world-actions";
import Link from "next/link";
import { LogHoursForm, JoinProjectButton } from "../client";

export default async function ServiceProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const project = await getServiceProjectDetail(params.id);
  if (!project) redirect("/service-projects");

  const myVolunteer = project.volunteers.find((v) => v.studentId === session.user.id);
  const hoursProgress = project.totalHoursGoal
    ? Math.round((project.currentHours / project.totalHoursGoal) * 100)
    : 0;
  const spotsLeft = project.volunteersNeeded - project.volunteers.length;

  const statusColors: Record<string, string> = {
    RECRUITING: "#16a34a",
    IN_PROGRESS: "#3b82f6",
    COMPLETED: "#7c3aed",
  };
  const color = statusColors[project.status] || "#6b7280";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/service-projects" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; All Projects
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{project.title}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
              {project.status.replace("_", " ")}
            </span>
            {project.passionArea && <span className="pill" style={{ fontSize: 11 }}>{project.passionArea}</span>}
          </div>
        </div>
        {!myVolunteer && project.status === "RECRUITING" && spotsLeft > 0 && (
          <JoinProjectButton projectId={project.id} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        {/* Main */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8 }}>About This Project</h3>
            <p style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {project.description}
            </p>
            {project.partnerOrg && (
              <div style={{ marginTop: 12, padding: 10, background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Partner Organization</div>
                <div style={{ fontWeight: 600 }}>{project.partnerOrg}</div>
              </div>
            )}
          </div>

          {/* Hours Progress */}
          {project.totalHoursGoal && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Impact Progress</h3>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{project.currentHours} / {project.totalHoursGoal} hours</span>
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{hoursProgress}%</span>
              </div>
              <div style={{ width: "100%", height: 10, background: "var(--gray-200)", borderRadius: 5, marginBottom: 8 }}>
                <div style={{ width: `${Math.min(hoursProgress, 100)}%`, height: "100%", background: color, borderRadius: 5 }} />
              </div>
              {project.impactSummary && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
                  {project.impactSummary}
                </p>
              )}
            </div>
          )}

          {/* Log hours (if volunteer) */}
          {myVolunteer && project.status !== "COMPLETED" && (
            <div className="card" style={{ marginBottom: 16 }}>
              <LogHoursForm projectId={project.id} />
            </div>
          )}

          {/* Volunteer Leaderboard */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>
              Volunteers ({project.volunteers.length}/{project.volunteersNeeded})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {project.volunteers.map((vol, i) => {
                const isMe = vol.studentId === session.user.id;
                return (
                  <div
                    key={vol.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      background: isMe ? "var(--ypp-purple-50)" : "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      border: isMe ? "1px solid var(--ypp-purple)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "var(--gray-200)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: i < 3 ? "white" : "var(--text-secondary)",
                      }}>
                        {i + 1}
                      </span>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: isMe ? 700 : 500 }}>
                          {vol.student.name} {isMe && "(you)"}
                        </span>
                        {vol.role && (
                          <span style={{ fontSize: 11, color, marginLeft: 6 }}>{vol.role}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {vol.hoursLogged} hrs
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ position: "sticky", top: 16 }}>
            <h4 style={{ marginBottom: 12 }}>Project Details</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {project.location && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Location</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{project.location}</div>
                </div>
              )}
              {project.startDate && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Start Date</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {new Date(project.startDate).toLocaleDateString()}
                  </div>
                </div>
              )}
              {project.endDate && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>End Date</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {new Date(project.endDate).toLocaleDateString()}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>XP Reward</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ypp-purple)" }}>
                  {project.xpReward} XP
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Certificate</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {project.certificateOnComplete ? "Yes, on completion" : "No"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Created By</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{project.createdBy.name}</div>
              </div>
              {myVolunteer && (
                <div style={{ padding: 10, background: "#dcfce7", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Your Hours</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
                    {myVolunteer.hoursLogged}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
