import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ResourceLibraryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const resources = await prisma.resource.findMany({
    include: {
      uploadedBy: true,
      course: true
    },
    orderBy: { createdAt: "desc" }
  });

  const publicResources = resources.filter(r => r.isPublic);
  const privateResources = resources.filter(r => !r.isPublic);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Resource Library Management</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Manage Global Resource Library</h3>
        <p>Curate and organize resources available to all instructors and students.</p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{resources.length}</div>
          <div className="kpi-label">Total Resources</div>
        </div>
        <div className="card">
          <div className="kpi">{publicResources.length}</div>
          <div className="kpi-label">Public Resources</div>
        </div>
        <div className="card">
          <div className="kpi">{privateResources.length}</div>
          <div className="kpi-label">Private Resources</div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="section-title">All Resources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {resources.length === 0 ? (
            <div className="card">
              <p style={{ color: "var(--text-secondary)" }}>No resources in the library yet.</p>
            </div>
          ) : (
            resources.map(resource => (
              <div key={resource.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h4>{resource.title}</h4>
                      <span className={`pill ${resource.isPublic ? 'success' : 'secondary'}`}>
                        {resource.isPublic ? "Public" : "Private"}
                      </span>
                      <span className="pill">{resource.type}</span>
                    </div>
                    {resource.description && (
                      <p style={{ fontSize: 14, marginBottom: 8 }}>{resource.description}</p>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Uploaded by {resource.uploadedBy.name}
                      {resource.course && ` • ${resource.course.title}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="button secondary small">
                      View
                    </a>
                    <form action="/api/admin/resources/toggle-visibility" method="POST">
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <button type="submit" className="button secondary small">
                        {resource.isPublic ? "Make Private" : "Make Public"}
                      </button>
                    </form>
                    <form action="/api/admin/resources/delete" method="POST">
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <button type="submit" className="button secondary small">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
