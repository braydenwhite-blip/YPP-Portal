import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  archiveChallenge,
  createChallenge,
  getChallengeAdminList,
  publishChallenge,
  unpublishChallenge,
  updateChallenge,
} from "@/lib/challenge-gamification-actions";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  ACTIVE: "#16a34a",
  COMPLETED: "#2563eb",
  ARCHIVED: "#9ca3af",
};

function formatDateInput(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function publishChallengeAction(formData: FormData) {
  "use server";
  const challengeId = String(formData.get("challengeId") || "");
  if (!challengeId) throw new Error("Challenge id is required");
  await publishChallenge(challengeId);
}

async function unpublishChallengeAction(formData: FormData) {
  "use server";
  const challengeId = String(formData.get("challengeId") || "");
  if (!challengeId) throw new Error("Challenge id is required");
  await unpublishChallenge(challengeId);
}

async function archiveChallengeAction(formData: FormData) {
  "use server";
  const challengeId = String(formData.get("challengeId") || "");
  if (!challengeId) throw new Error("Challenge id is required");
  await archiveChallenge(challengeId);
}

export default async function AdminChallengesPage() {
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
  if (!canManage) redirect("/challenges");

  const challenges = await getChallengeAdminList();

  const draftCount = challenges.filter((challenge) => challenge.status === "DRAFT").length;
  const activeCount = challenges.filter((challenge) => challenge.status === "ACTIVE").length;
  const archivedCount = challenges.filter((challenge) => challenge.status === "ARCHIVED").length;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Challenge Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Create, schedule, publish, and archive challenge cycles.
          </p>
        </div>
        <Link href="/challenges" className="button secondary">
          View Challenges
        </Link>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{challenges.length}</div>
          <div className="kpi-label">Total</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#6b7280" }}>{draftCount}</div>
          <div className="kpi-label">Draft</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#16a34a" }}>{activeCount}</div>
          <div className="kpi-label">Active</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#9ca3af" }}>{archivedCount}</div>
          <div className="kpi-label">Archived</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Create Challenge</h3>
        <form action={createChallenge} className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Type
              <select className="input" name="type" defaultValue="DAILY" required>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="THIRTY_DAY">30-Day</option>
                <option value="SEASONAL">Seasonal</option>
              </select>
            </label>
          </div>
          <label className="form-row">
            Description
            <textarea className="input" rows={3} name="description" required />
          </label>
          <div className="grid three">
            <label className="form-row">
              Passion Area
              <input className="input" name="passionArea" placeholder="Music, Art, Coding" />
            </label>
            <label className="form-row">
              Start Date
              <input className="input" type="date" name="startDate" required />
            </label>
            <label className="form-row">
              End Date
              <input className="input" type="date" name="endDate" required />
            </label>
          </div>
          <div className="grid three">
            <label className="form-row">
              XP Reward
              <input className="input" type="number" min={1} name="xpReward" defaultValue={50} />
            </label>
            <label className="form-row">
              Daily Goal
              <input className="input" name="dailyGoal" placeholder="Practice 15 minutes" />
            </label>
            <label className="form-row">
              Weekly Goal
              <input className="input" name="weeklyGoal" placeholder="Complete 3 sessions" />
            </label>
          </div>
          <div className="grid two">
            <label className="form-row">
              Prompt Text (weekly)
              <input className="input" name="promptText" />
            </label>
            <label className="form-row">
              Special Recognition
              <input className="input" name="specialRecognition" />
            </label>
          </div>
          <input type="hidden" name="submissionRequired" value="false" />
          <input type="hidden" name="showLeaderboard" value="true" />
          <input type="hidden" name="votingEnabled" value="false" />
          <button className="button primary" type="submit">
            Create Draft Challenge
          </button>
        </form>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {challenges.map((challenge) => {
          const statusColor = STATUS_COLORS[challenge.status] ?? "#6b7280";
          return (
            <div key={challenge.id} className="card" style={{ borderLeft: `4px solid ${statusColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ margin: 0 }}>{challenge.title}</h3>
                    <span
                      className="pill"
                      style={{ background: `${statusColor}15`, color: statusColor, fontWeight: 600, fontSize: 11 }}
                    >
                      {challenge.status}
                    </span>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {challenge.type.replace("_", "-")}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {challenge.description}
                  </p>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
                    <span>
                      {formatDateInput(challenge.startDate)} to {formatDateInput(challenge.endDate)}
                    </span>
                    <span>{challenge.xpReward} XP</span>
                    <span>{challenge._count.participants} participants</span>
                    <span>{challenge._count.submissions} submissions</span>
                    {challenge.passionArea && <span>{challenge.passionArea}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {challenge.status === "DRAFT" ? (
                    <form action={publishChallengeAction}>
                      <input type="hidden" name="challengeId" value={challenge.id} />
                      <button className="button primary small" type="submit">Publish</button>
                    </form>
                  ) : null}
                  {challenge.status === "ACTIVE" ? (
                    <form action={unpublishChallengeAction}>
                      <input type="hidden" name="challengeId" value={challenge.id} />
                      <button className="button secondary small" type="submit">Unpublish</button>
                    </form>
                  ) : null}
                  {challenge.status !== "ARCHIVED" ? (
                    <form action={archiveChallengeAction}>
                      <input type="hidden" name="challengeId" value={challenge.id} />
                      <button className="button secondary small" type="submit">Archive</button>
                    </form>
                  ) : null}
                </div>
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
                  Edit challenge settings
                </summary>
                <form action={updateChallenge} className="form-grid" style={{ marginTop: 12 }}>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <div className="grid two">
                    <label className="form-row">
                      Title
                      <input className="input" name="title" defaultValue={challenge.title} required />
                    </label>
                    <label className="form-row">
                      Passion Area
                      <input className="input" name="passionArea" defaultValue={challenge.passionArea ?? ""} />
                    </label>
                  </div>
                  <label className="form-row">
                    Description
                    <textarea className="input" rows={3} name="description" defaultValue={challenge.description} required />
                  </label>
                  <div className="grid three">
                    <label className="form-row">
                      Start Date
                      <input className="input" type="date" name="startDate" defaultValue={formatDateInput(challenge.startDate)} />
                    </label>
                    <label className="form-row">
                      End Date
                      <input className="input" type="date" name="endDate" defaultValue={formatDateInput(challenge.endDate)} />
                    </label>
                    <label className="form-row">
                      XP Reward
                      <input className="input" type="number" min={1} name="xpReward" defaultValue={challenge.xpReward} />
                    </label>
                  </div>
                  <div className="grid two">
                    <label className="form-row">
                      Daily Goal
                      <input className="input" name="dailyGoal" defaultValue={challenge.dailyGoal ?? ""} />
                    </label>
                    <label className="form-row">
                      Weekly Goal
                      <input className="input" name="weeklyGoal" defaultValue={challenge.weeklyGoal ?? ""} />
                    </label>
                  </div>
                  <div className="grid two">
                    <label className="form-row">
                      Prompt Text
                      <input className="input" name="promptText" defaultValue={challenge.promptText ?? ""} />
                    </label>
                    <label className="form-row">
                      Special Recognition
                      <input className="input" name="specialRecognition" defaultValue={challenge.specialRecognition ?? ""} />
                    </label>
                  </div>
                  <button className="button secondary small" type="submit">
                    Save Changes
                  </button>
                </form>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
