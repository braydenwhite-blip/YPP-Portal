import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PathwayTrackingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get all pathway progress records
  const pathwayProgress = await prisma.pathwayProgress.findMany({
    include: {
      student: true,
      pathway: true,
      completedMilestones: {
        include: {
          milestone: true
        }
      }
    },
    orderBy: { lastActivityAt: 'desc' }
  });

  // Get pathway statistics
  const pathways = await prisma.pathway.findMany({
    include: {
      _count: {
        select: {
          studentProgress: true,
          milestones: true
        }
      }
    }
  });

  // Calculate completion stats
  const statusGroups = pathwayProgress.reduce((acc, progress) => {
    acc[progress.status] = (acc[progress.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalStudents = pathwayProgress.length;
  const completedCount = statusGroups['COMPLETED'] || 0;
  const inProgressCount = statusGroups['IN_PROGRESS'] || 0;
  const notStartedCount = statusGroups['NOT_STARTED'] || 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Pathway Completion Tracking</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Track Student Progress Through Pathways</h3>
        <p>Monitor pathway completion rates, identify bottlenecks, and recognize high achievers.</p>
      </div>

      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{totalStudents}</div>
          <div className="kpi-label">Total Students</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--success-color)" }}>{completedCount}</div>
          <div className="kpi-label">Completed Pathways</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--warning-color)" }}>{inProgressCount}</div>
          <div className="kpi-label">In Progress</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0}%</div>
          <div className="kpi-label">Completion Rate</div>
        </div>
      </div>

      {/* Pathway stats */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Pathways Overview</div>
        <div className="grid two">
          {pathways.map(pathway => {
            const progressRecords = pathwayProgress.filter(p => p.pathwayId === pathway.id);
            const completed = progressRecords.filter(p => p.status === 'COMPLETED').length;
            const completionRate = progressRecords.length > 0 
              ? Math.round((completed / progressRecords.length) * 100) 
              : 0;

            return (
              <div key={pathway.id} className="card">
                <h3>{pathway.name}</h3>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>Students Enrolled</span>
                    <strong>{pathway._count.studentProgress}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>Milestones</span>
                    <strong>{pathway._count.milestones}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>Completed</span>
                    <strong>{completed}</strong>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>Completion Rate: {completionRate}%</div>
                    <div style={{
                      height: 8,
                      backgroundColor: "var(--accent-bg)",
                      borderRadius: 4,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${completionRate}%`,
                        backgroundColor: "var(--success-color)",
                        borderRadius: 4
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent completions */}
      <div>
        <div className="section-title">Recent Pathway Activity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pathwayProgress.slice(0, 15).map(progress => {
            const milestoneCount = progress.completedMilestones.length;
            const totalMilestones = progress.pathway._count?.milestones || 0;
            const progressPercent = totalMilestones > 0 
              ? Math.round((milestoneCount / totalMilestones) * 100) 
              : 0;

            const statusColor = 
              progress.status === 'COMPLETED' ? 'success' :
              progress.status === 'IN_PROGRESS' ? 'warning' :
              'secondary';

            return (
              <div key={progress.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h4>{progress.student.name}</h4>
                      <span className={`pill ${statusColor}`}>
                        {progress.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {progress.pathway.name}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      {milestoneCount} / {totalMilestones} milestones completed ({progressPercent}%)
                    </div>
                    <div style={{
                      height: 6,
                      backgroundColor: "var(--accent-bg)",
                      borderRadius: 3,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${progressPercent}%`,
                        backgroundColor: progress.status === 'COMPLETED' ? "var(--success-color)" : "var(--warning-color)",
                        borderRadius: 3
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 16 }}>
                    {new Date(progress.lastActivityAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
