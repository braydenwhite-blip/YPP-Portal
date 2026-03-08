import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  addMentorCommitteeMember,
  createMentorCommittee,
  createMentorshipTrack,
  updateMentorshipGovernance,
} from "@/lib/mentorship-program-actions";
import { prisma } from "@/lib/prisma";
import { getProgramAnalytics } from "@/lib/mentorship-overview-actions";
import TabLayout from "./tab-layout";
import PairingsPanel from "./pairings-panel";
import ChairsPanel from "./chairs-panel";
import GoalsPanel from "./goals-panel";
import AnalyticsPanel from "./analytics-panel";

export const metadata = { title: "Mentorship Program — Admin" };

export default async function MentorshipProgramAdminPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  // Parallel data fetch
  const [pairings, goals, chairs, potentialMentors, potentialMentees, analytics, tracks, committees, governanceUsers] = await Promise.all([
    // All mentorships (active + past) involving roles that participate in the program
    prisma.mentorship.findMany({
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
        chair: { select: { id: true, name: true } },
        track: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "desc" },
    }),

    // All program goals, sorted by role + order
    prisma.mentorshipProgramGoal.findMany({
      orderBy: [{ roleType: "asc" }, { sortOrder: "asc" }],
    }),

    // All committee chair records (active + past)
    prisma.mentorCommitteeChair.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),

    // Potential mentors: users with MENTOR, ADMIN, or STAFF role
    prisma.user.findMany({
      where: {
        roles: {
          some: { role: { in: ["MENTOR", "ADMIN", "STAFF"] } },
        },
      },
      select: { id: true, name: true, email: true, primaryRole: true },
      orderBy: { name: "asc" },
    }),

    // Potential mentees: Instructors, Chapter Leads, and Admin/Staff
    prisma.user.findMany({
      where: {
        primaryRole: { in: ["INSTRUCTOR", "CHAPTER_LEAD", "ADMIN", "STAFF"] },
      },
      select: { id: true, name: true, email: true, primaryRole: true },
      orderBy: { name: "asc" },
    }),

    // Program analytics for the Reports tab
    getProgramAnalytics(),

    prisma.mentorshipTrack.findMany({
      include: {
        committees: {
          include: {
            chairUser: { select: { id: true, name: true } },
            members: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: { select: { mentorships: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),

    prisma.mentorCommittee.findMany({
      include: {
        track: true,
        chairUser: { select: { id: true, name: true } },
      },
      orderBy: [{ track: { name: "asc" } }, { name: "asc" }],
    }),

    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              in: ["MENTOR", "CHAPTER_LEAD", "ADMIN", "STAFF"],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        roles: { select: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize for client components (dates → strings)
  const serializedPairings = pairings.map((m) => ({
    id: m.id,
    mentorName: m.mentor.name,
    mentorEmail: m.mentor.email,
    menteeName: m.mentee.name,
    menteeEmail: m.mentee.email,
    menteeRole: m.mentee.primaryRole,
    startDate: m.startDate.toISOString(),
    status: m.status,
  }));

  const serializedChairs = chairs.map((c) => ({
    id: c.id,
    userId: c.userId,
    userName: c.user.name,
    userEmail: c.user.email,
    roleType: c.roleType,
    isActive: c.isActive,
  }));

  const serializedGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    roleType: g.roleType,
    isActive: g.isActive,
    sortOrder: g.sortOrder,
  }));

  const activePairings = serializedPairings.filter((p) => p.status === "ACTIVE");
  const activeChairs = serializedChairs.filter((c) => c.isActive);
  const activeGoals = serializedGoals.filter((g) => g.isActive);

  // Mentees who already have an active pairing (exclude from dropdown)
  const menteeIdsWithActivePairing = new Set(activePairings.map((p) => {
    // find menteeId from full pairings
    const full = pairings.find((m) => m.id === p.id);
    return full?.menteeId ?? "";
  }));

  const availableMentees = potentialMentees.filter(
    (u) => !menteeIdsWithActivePairing.has(u.id)
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Mentorship Program</h1>
          <p className="page-subtitle">
            Manage mentor pairings, committee chairs, and role-specific goals for the YPP Mentorship Program
          </p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid four" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <p className="kpi">{activePairings.length}</p>
          <p className="kpi-label">Active Pairings</p>
        </div>
        <div className="card">
          <p className="kpi">{activeChairs.length} / 3</p>
          <p className="kpi-label">Committee Chairs Filled</p>
        </div>
        <div className="card">
          <p className="kpi">{activeGoals.length}</p>
          <p className="kpi-label">Active Goals</p>
        </div>
        <div className="card">
          <p className="kpi">{pairings.filter((p) => p.status !== "ACTIVE").length}</p>
          <p className="kpi-label">Completed Pairings</p>
        </div>
      </div>

      <TabLayout
        stats={{
          activePairings: activePairings.length,
          activeChairs: activeChairs.length,
          activeGoals: activeGoals.length,
        }}
        pairingsPanel={
          <PairingsPanel
            pairings={serializedPairings}
            potentialMentors={potentialMentors}
            potentialMentees={availableMentees}
          />
        }
        chairsPanel={
          <ChairsPanel
            chairs={serializedChairs}
            eligibleUsers={potentialMentors}
          />
        }
        goalsPanel={<GoalsPanel goals={serializedGoals} />}
        reportsPanel={analytics ? <AnalyticsPanel analytics={analytics} /> : <p style={{ color: "var(--muted)" }}>No analytics data available.</p>}
      />

      <div style={{ marginTop: "2rem" }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Governance Extensions
        </div>
        <p style={{ margin: "0 0 1.5rem", color: "var(--muted)", fontSize: 13 }}>
          These controls extend the existing mentorship program with tracks, mentor committees,
          kickoff tracking, and pairing governance for the monthly review workflow.
        </p>

        <div className="grid two" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-title">Create Mentorship Track</div>
            <form action={createMentorshipTrack} className="form-grid">
              <div className="form-row">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  required
                  placeholder="Instructor Mentorship"
                />
              </div>
              <div className="form-row">
                <label>Slug</label>
                <input
                  type="text"
                  name="slug"
                  className="input"
                  required
                  placeholder="instructor-mentorship"
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea name="description" className="input" rows={3} />
              </div>
              <div className="form-row">
                <label>Scope</label>
                <select name="scope" className="input" defaultValue="GLOBAL">
                  <option value="GLOBAL">Global</option>
                  <option value="CHAPTER">Chapter</option>
                </select>
              </div>
              <div className="form-row">
                <label>Point Category</label>
                <select name="pointCategory" className="input" defaultValue="CUSTOM">
                  <option value="CUSTOM">Custom / No Auto Points</option>
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="CHAPTER_PRESIDENT">Chapter President</option>
                  <option value="GLOBAL_LEADERSHIP">Global Leadership</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <button type="submit" className="button">
                Create Track
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">Create Mentor Committee</div>
            <form action={createMentorCommittee} className="form-grid">
              <div className="form-row">
                <label>Track</label>
                <select name="trackId" className="input" required>
                  <option value="">Select track...</option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Committee Name</label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  required
                  placeholder="Instructor Mentor Committee"
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea name="description" className="input" rows={3} />
              </div>
              <div className="form-row">
                <label>Chair</label>
                <select name="chairUserId" className="input">
                  <option value="">No chair yet</option>
                  {governanceUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="button secondary">
                Create Committee
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Committee Membership</div>
          <form action={addMentorCommitteeMember} className="grid three" style={{ alignItems: "end" }}>
            <div className="form-row">
              <label>Committee</label>
              <select name="committeeId" className="input" required>
                <option value="">Select committee...</option>
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>
                    {committee.track.name} · {committee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>User</label>
              <select name="userId" className="input" required>
                <option value="">Select user...</option>
                {governanceUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.roles.map((role) => role.role).join(", ")})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Committee Role</label>
              <select name="role" className="input" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="CHAIR">Chair</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <button type="submit" className="button">
              Add Or Update Member
            </button>
          </form>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Mentorship Tracks</div>
          {tracks.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No mentorship tracks created yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {tracks.map((track) => (
                <div
                  key={track.id}
                  style={{
                    padding: 16,
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <strong>{track.name}</strong>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {track.scope} · {track.pointCategory.replace(/_/g, " ")} ·{" "}
                        {track._count.mentorships} active pairings
                      </div>
                      {track.description && (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                          {track.description}
                        </p>
                      )}
                    </div>
                    <span className={`pill ${track.isActive ? "pill-success" : "pill-declined"}`}>
                      {track.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {track.committees.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ display: "block", marginBottom: 8 }}>Committees</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {track.committees.map((committee) => (
                          <div key={committee.id} style={{ fontSize: 13 }}>
                            <strong>{committee.name}</strong>
                            <span style={{ color: "var(--muted)" }}>
                              {" "}· Chair: {committee.chairUser?.name || "Unassigned"} · Members:{" "}
                              {committee.members.length}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Active Pairing Governance</div>
          {pairings.filter((pairing) => pairing.status === "ACTIVE").length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No active mentorship pairings yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pairings
                .filter((pairing) => pairing.status === "ACTIVE")
                .map((pairing) => (
                  <form
                    key={pairing.id}
                    action={updateMentorshipGovernance}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <input type="hidden" name="mentorshipId" value={pairing.id} />
                    <div style={{ marginBottom: 12 }}>
                      <strong>{pairing.mentee.name}</strong>
                      <span style={{ color: "var(--muted)" }}>
                        {" "}· Mentor: {pairing.mentor.name} · {pairing.mentee.primaryRole.replace("_", " ")}
                      </span>
                    </div>
                    <div className="grid four" style={{ alignItems: "end" }}>
                      <div className="form-row">
                        <label>Track</label>
                        <select name="trackId" className="input" defaultValue={pairing.trackId ?? ""}>
                          <option value="">No track</option>
                          {tracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-row">
                        <label>Chair</label>
                        <select name="chairId" className="input" defaultValue={pairing.chairId ?? ""}>
                          <option value="">No chair</option>
                          {governanceUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-row">
                        <label>Kickoff Scheduled</label>
                        <input
                          type="date"
                          name="kickoffScheduledAt"
                          className="input"
                          defaultValue={
                            pairing.kickoffScheduledAt
                              ? pairing.kickoffScheduledAt.toISOString().slice(0, 10)
                              : ""
                          }
                        />
                      </div>
                      <div className="form-row">
                        <label>Kickoff Completed</label>
                        <input
                          type="date"
                          name="kickoffCompletedAt"
                          className="input"
                          defaultValue={
                            pairing.kickoffCompletedAt
                              ? pairing.kickoffCompletedAt.toISOString().slice(0, 10)
                              : ""
                          }
                        />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: 12 }}>
                      <label>Pairing Notes</label>
                      <textarea
                        name="notes"
                        className="input"
                        rows={3}
                        defaultValue={pairing.notes ?? ""}
                        placeholder="Add getting-started notes, assignment context, or workload notes."
                      />
                    </div>
                    <button type="submit" className="button small" style={{ marginTop: 12 }}>
                      Save Pairing Governance
                    </button>
                  </form>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
