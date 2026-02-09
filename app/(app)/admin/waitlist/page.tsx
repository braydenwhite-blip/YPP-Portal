import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function WaitlistAutomationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const waitlistEntries = await prisma.courseWaitlist.findMany({
    where: { status: "WAITING" },
    include: {
      student: true,
      course: {
        include: {
          _count: {
            select: { enrollments: true }
          }
        }
      }
    },
    orderBy: { joinedAt: "asc" }
  });

  // Group by course
  const waitlistByCourse = waitlistEntries.reduce((acc, entry) => {
    const courseId = entry.courseId;
    if (!acc[courseId]) {
      acc[courseId] = {
        course: entry.course,
        entries: []
      };
    }
    acc[courseId].entries.push(entry);
    return acc;
  }, {} as Record<string, any>);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Waitlist Automation</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Automated Waitlist Management</h3>
        <p>Automatically notify and enroll students when spots become available in full courses.</p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{waitlistEntries.length}</div>
          <div className="kpi-label">Waiting Students</div>
        </div>
        <div className="card">
          <div className="kpi">{Object.keys(waitlistByCourse).length}</div>
          <div className="kpi-label">Courses with Waitlists</div>
        </div>
        <div className="card">
          <form action="/api/admin/waitlist/process-all" method="POST">
            <button type="submit" className="button primary" style={{ marginTop: 20 }}>
              Process All Waitlists
            </button>
          </form>
        </div>
      </div>

      {Object.keys(waitlistByCourse).length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>No active waitlists at this time.</p>
        </div>
      ) : (
        Object.values(waitlistByCourse).map((item: any) => {
          const spotsAvailable = item.course.maxStudents
            ? item.course.maxStudents - item.course._count.enrollments
            : 0;

          return (
            <div key={item.course.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                <div>
                  <h3>{item.course.title}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {item.course._count.enrollments} / {item.course.maxStudents || "∞"} enrolled
                    • {item.entries.length} waiting
                    {spotsAvailable > 0 && (
                      <span style={{ color: "var(--success-color)", marginLeft: 8 }}>
                        • {spotsAvailable} spots available
                      </span>
                    )}
                  </div>
                </div>
                <form action="/api/admin/waitlist/process-course" method="POST">
                  <input type="hidden" name="courseId" value={item.course.id} />
                  <button type="submit" className="button primary small">
                    Process Waitlist
                  </button>
                </form>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {item.entries.slice(0, 5).map((entry: any, index: number) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: 12,
                      backgroundColor: index === 0 && spotsAvailable > 0 ? "var(--success-bg)" : "var(--accent-bg)",
                      borderRadius: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>#{index + 1} - {entry.student.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        Joined waitlist: {new Date(entry.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {index === 0 && spotsAvailable > 0 && (
                      <div style={{ fontSize: 12, color: "var(--success-color)", fontWeight: 600 }}>
                        Next in line
                      </div>
                    )}
                  </div>
                ))}
                {item.entries.length > 5 && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
                    + {item.entries.length - 5} more waiting
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
