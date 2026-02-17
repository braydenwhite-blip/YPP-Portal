import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createChallenge } from "@/lib/challenge-gamification-actions";
import {
  createTalentActivity,
  createTryItActivity,
  getActivityAdminCatalog,
  toggleTalentActivity,
  toggleTryItActivity,
} from "@/lib/activity-admin-actions";

const TAB_KEYS = ["try-it", "talent", "portal", "incubator"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function normalizeTab(tab: string | undefined): TabKey {
  if (!tab) return "try-it";
  if (TAB_KEYS.includes(tab as TabKey)) return tab as TabKey;
  return "try-it";
}

async function toggleTryItAction(formData: FormData) {
  "use server";
  const sessionId = String(formData.get("sessionId") || "");
  const nextActive = formData.get("nextActive") === "true";
  if (!sessionId) throw new Error("sessionId is required");
  await toggleTryItActivity(sessionId, nextActive);
}

async function toggleTalentAction(formData: FormData) {
  "use server";
  const challengeId = String(formData.get("challengeId") || "");
  const nextActive = formData.get("nextActive") === "true";
  if (!challengeId) throw new Error("challengeId is required");
  await toggleTalentActivity(challengeId, nextActive);
}

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = (session.user as any).roles ?? [];
  const primaryRole = (session.user as any).primaryRole;
  const canManage =
    roles.includes("ADMIN") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    primaryRole === "ADMIN" ||
    primaryRole === "INSTRUCTOR" ||
    primaryRole === "CHAPTER_LEAD";
  if (!canManage) redirect("/activities");

  const tab = normalizeTab(searchParams?.tab);
  const catalog = await getActivityAdminCatalog();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Activities Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Manage Try-It sessions, Talent challenges, portal challenges, and incubator-linked activity.
          </p>
        </div>
        <Link href="/activities" className="button secondary">
          View Student Activity Hub
        </Link>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{catalog.tryItSessions.length}</div>
          <div className="kpi-label">Try-It Sessions</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{catalog.talentChallenges.length}</div>
          <div className="kpi-label">Talent Challenges</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{catalog.portalChallenges.length}</div>
          <div className="kpi-label">Portal Challenges</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{catalog.incubatorProjects.length}</div>
          <div className="kpi-label">Recent Incubator Projects</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/activities?tab=try-it" className="button secondary small" style={tab === "try-it" ? { fontWeight: 700 } : undefined}>
            Try-It
          </Link>
          <Link href="/admin/activities?tab=talent" className="button secondary small" style={tab === "talent" ? { fontWeight: 700 } : undefined}>
            Talent
          </Link>
          <Link href="/admin/activities?tab=portal" className="button secondary small" style={tab === "portal" ? { fontWeight: 700 } : undefined}>
            Portal Challenges
          </Link>
          <Link href="/admin/activities?tab=incubator" className="button secondary small" style={tab === "incubator" ? { fontWeight: 700 } : undefined}>
            Incubator
          </Link>
        </div>
      </div>

      {tab === "try-it" && (
        <div className="grid two">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Create Try-It Session</h3>
            <form action={createTryItActivity} className="form-grid">
              <label className="form-row">
                Title
                <input className="input" name="title" required />
              </label>
              <label className="form-row">
                Description
                <textarea className="input" rows={3} name="description" required />
              </label>
              <div className="grid two">
                <label className="form-row">
                  Passion Area
                  <select className="input" name="passionId" required>
                    <option value="">Select one</option>
                    {catalog.passionAreas.map((passion) => (
                      <option key={passion.id} value={passion.id}>
                        {passion.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  Duration (minutes)
                  <input className="input" name="duration" type="number" min={1} defaultValue={15} required />
                </label>
              </div>
              <label className="form-row">
                Video URL
                <input className="input" name="videoUrl" type="url" required />
              </label>
              <div className="grid two">
                <label className="form-row">
                  Presenter
                  <input className="input" name="presenter" />
                </label>
                <label className="form-row">
                  Display Order
                  <input className="input" name="order" type="number" min={0} defaultValue={0} />
                </label>
              </div>
              <label className="form-row">
                What students will learn
                <textarea className="input" rows={2} name="whatYoullLearn" />
              </label>
              <label className="form-row">
                Materials needed
                <input className="input" name="materialsNeeded" />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" name="isActive" defaultChecked />
                Publish immediately
              </label>
              <button className="button primary" type="submit">Create Try-It Session</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Existing Try-It Sessions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catalog.tryItSessions.map((session) => (
                <div key={session.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{session.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {session.duration} min · {session.passionId}
                      </div>
                    </div>
                    <form action={toggleTryItAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="nextActive" value={String(!session.isActive)} />
                      <button className="button secondary small" type="submit">
                        {session.isActive ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "talent" && (
        <div className="grid two">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Create Talent Challenge</h3>
            <form action={createTalentActivity} className="form-grid">
              <label className="form-row">
                Title
                <input className="input" name="title" required />
              </label>
              <label className="form-row">
                Description
                <textarea className="input" rows={2} name="description" required />
              </label>
              <label className="form-row">
                Instructions
                <textarea className="input" rows={3} name="instructions" required />
              </label>
              <div className="grid three">
                <label className="form-row">
                  Primary Passion
                  <select className="input" name="passionId">
                    <option value="">Select one</option>
                    {catalog.passionAreas.map((passion) => (
                      <option key={passion.id} value={passion.id}>
                        {passion.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  Difficulty
                  <select className="input" name="difficulty" defaultValue="EASY">
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </label>
                <label className="form-row">
                  Est. Minutes
                  <input className="input" name="estimatedMinutes" type="number" min={5} defaultValue={20} />
                </label>
              </div>
              <label className="form-row">
                Passion IDs (comma-separated, optional override)
                <input className="input" name="passionIds" placeholder="id1,id2" />
              </label>
              <div className="grid two">
                <label className="form-row">
                  Video URL
                  <input className="input" name="videoUrl" type="url" />
                </label>
                <label className="form-row">
                  Display Order
                  <input className="input" name="order" type="number" min={0} defaultValue={0} />
                </label>
              </div>
              <label className="form-row">
                Materials Needed
                <input className="input" name="materialsNeeded" />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" name="isActive" defaultChecked />
                Publish immediately
              </label>
              <button className="button primary" type="submit">Create Talent Challenge</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Existing Talent Challenges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catalog.talentChallenges.map((challenge) => (
                <div key={challenge.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{challenge.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {challenge.difficulty} · {challenge.estimatedMinutes} min
                      </div>
                    </div>
                    <form action={toggleTalentAction}>
                      <input type="hidden" name="challengeId" value={challenge.id} />
                      <input type="hidden" name="nextActive" value={String(!challenge.isActive)} />
                      <button className="button secondary small" type="submit">
                        {challenge.isActive ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "portal" && (
        <div className="grid two">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Quick Create Portal Challenge</h3>
            <form action={createChallenge} className="form-grid">
              <label className="form-row">
                Title
                <input className="input" name="title" required />
              </label>
              <label className="form-row">
                Description
                <textarea className="input" rows={3} name="description" required />
              </label>
              <div className="grid two">
                <label className="form-row">
                  Type
                  <select className="input" name="type" defaultValue="WEEKLY">
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="THIRTY_DAY">30-Day</option>
                    <option value="SEASONAL">Seasonal</option>
                  </select>
                </label>
                <label className="form-row">
                  Passion Area
                  <input className="input" name="passionArea" />
                </label>
              </div>
              <div className="grid three">
                <label className="form-row">
                  Start Date
                  <input className="input" type="date" name="startDate" required />
                </label>
                <label className="form-row">
                  End Date
                  <input className="input" type="date" name="endDate" required />
                </label>
                <label className="form-row">
                  XP Reward
                  <input className="input" type="number" min={1} name="xpReward" defaultValue={50} />
                </label>
              </div>
              <input type="hidden" name="submissionRequired" value="false" />
              <input type="hidden" name="showLeaderboard" value="true" />
              <input type="hidden" name="votingEnabled" value="false" />
              <button className="button primary" type="submit">Create Draft Portal Challenge</button>
            </form>
            <div style={{ marginTop: 10 }}>
              <Link href="/admin/challenges" className="button secondary small">
                Open Full Challenge Manager
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Recent Portal Challenges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catalog.portalChallenges.slice(0, 8).map((challenge) => (
                <div key={challenge.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{challenge.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {challenge.status} · {challenge.type} · {challenge._count.participants} participants
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "incubator" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Incubator Activity Visibility</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Incubator activities come from cohort applications, active projects, and project updates.
            Use the incubator management pages to review applications and mentor assignments.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Link href="/admin/incubator" className="button primary small">Open Incubator Manager</Link>
            <Link href="/incubator" className="button secondary small">Open Student Incubator View</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catalog.incubatorProjects.map((project) => (
              <div key={project.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{project.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {project.student.name} · {project.cohort.name} · {project.currentPhase}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
