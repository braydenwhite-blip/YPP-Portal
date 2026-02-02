import { prisma } from "@/lib/prisma";

export default async function ChaptersPage() {
  const chapters = await prisma.chapter.findMany({
    include: {
      users: true,
      courses: true,
      events: true
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Network</p>
          <h1 className="page-title">Chapters & Community</h1>
        </div>
      </div>

      <div className="grid two">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="card">
            <h3>{chapter.name}</h3>
            <p>
              {chapter.city ?? ""} {chapter.region ? `• ${chapter.region}` : ""}
            </p>
            <div className="grid two" style={{ marginTop: 16 }}>
              <div>
                <div className="kpi">{chapter.users.length}</div>
                <div className="kpi-label">Members</div>
              </div>
              <div>
                <div className="kpi">{chapter.courses.length}</div>
                <div className="kpi-label">Classes & Labs</div>
              </div>
            </div>
            <div style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>
              Events scheduled: {chapter.events.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
