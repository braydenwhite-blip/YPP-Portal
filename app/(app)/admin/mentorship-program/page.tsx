import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TabLayout from "./tab-layout";
import PairingsPanel from "./pairings-panel";
import ChairsPanel from "./chairs-panel";
import GoalsPanel from "./goals-panel";

export const metadata = { title: "Mentorship Program — Admin" };

export default async function MentorshipProgramAdminPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  // Parallel data fetch
  const [pairings, goals, chairs, potentialMentors, potentialMentees] = await Promise.all([
    // All mentorships (active + past) involving roles that participate in the program
    prisma.mentorship.findMany({
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
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
      />
    </div>
  );
}
