import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  if (session.user.primaryRole !== "PARENT" && session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get children linked to this parent
  const children = await prisma.user.findMany({
    where: {
      parentId: session.user.id
    },
    include: {
      enrollments: {
        include: {
          course: {
            include: {
              leadInstructor: true
            }
          }
        },
        where: { status: "ENROLLED" }
      }
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">My Children's Progress</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Welcome to the Parent Portal</h3>
        <p>Track your children's progress, view their courses, and stay informed about their learning journey.</p>
      </div>

      {children.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            No children linked to your account yet. Contact an administrator to link student accounts.
          </p>
        </div>
      ) : (
        children.map(child => (
          <div key={child.id} style={{ marginBottom: 28 }}>
            <div className="section-title">{child.name}</div>
            
            <div className="grid three" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="kpi">{child.enrollments.length}</div>
                <div className="kpi-label">Active Courses</div>
              </div>
            </div>

            {child.enrollments.length > 0 && (
              <div className="card">
                <h4>Current Courses</h4>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {child.enrollments.map(enrollment => (
                    <div key={enrollment.id} style={{ padding: 12, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                      <div style={{ fontWeight: 600 }}>{enrollment.course.title}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                        Instructor: {enrollment.course.leadInstructor.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
