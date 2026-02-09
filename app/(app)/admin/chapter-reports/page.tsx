import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ChapterReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const chapters = await prisma.chapter.findMany({
    include: {
      _count: {
        select: {
          users: true,
          courses: true,
          events: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Chapter Performance Reports</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Chapter Performance Overview</h3>
        <p>Compare metrics across all chapters to identify high performers and areas needing support.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {chapters.map(chapter => (
          <div key={chapter.id} className="card">
            <h3>{chapter.name}</h3>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div>
                <div className="kpi">{chapter._count.users}</div>
                <div className="kpi-label">Members</div>
              </div>
              <div>
                <div className="kpi">{chapter._count.courses}</div>
                <div className="kpi-label">Courses</div>
              </div>
              <div>
                <div className="kpi">{chapter._count.events}</div>
                <div className="kpi-label">Events</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
