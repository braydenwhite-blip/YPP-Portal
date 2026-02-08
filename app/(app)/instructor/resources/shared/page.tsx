import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SharedResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get resources shared by this instructor
  const sharedResources = await prisma.resource.findMany({
    where: {
      uploaderId: session.user.id,
      isPublic: true
    },
    include: {
      course: true
    },
    orderBy: { createdAt: "desc" }
  });

  const now = new Date();
  const activeResources = sharedResources.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);
  const expiredResources = sharedResources.filter(r => r.expiresAt && new Date(r.expiresAt) <= now);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Shared Resources</h1>
        </div>
        <Link href="/instructor/resources/share" className="button primary">
          Share Resource
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Resource Sharing with Expiry</h3>
        <p>
          Share resources with students and set expiration dates for time-sensitive materials.
          Resources automatically become unavailable after the expiry date.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{activeResources.length}</div>
          <div className="kpi-label">Active Resources</div>
        </div>
        <div className="card">
          <div className="kpi">{expiredResources.length}</div>
          <div className="kpi-label">Expired Resources</div>
        </div>
        <div className="card">
          <div className="kpi">{sharedResources.length}</div>
          <div className="kpi-label">Total Shared</div>
        </div>
      </div>

      {/* Active resources */}
      {activeResources.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Active Shared Resources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeResources.map(resource => {
              const daysUntilExpiry = resource.expiresAt
                ? Math.ceil((new Date(resource.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <div key={resource.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{resource.title}</h3>
                        <span className="pill success">Active</span>
                        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
                          <span className="pill" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-color)" }}>
                            Expires in {daysUntilExpiry} days
                          </span>
                        )}
                      </div>

                      {resource.description && (
                        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                          {resource.description}
                        </p>
                      )}

                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {resource.course && `Course: ${resource.course.title} • `}
                        Type: {resource.type}
                      </div>

                      {resource.expiresAt && (
                        <div style={{ fontSize: 13, marginTop: 8 }}>
                          🕐 Expires: {new Date(resource.expiresAt).toLocaleDateString()}
                        </div>
                      )}

                      {!resource.expiresAt && (
                        <div style={{ fontSize: 13, marginTop: 8, color: "var(--success-color)" }}>
                          ♾️ No expiration date
                        </div>
                      )}
                    </div>

                    <div style={{ marginLeft: 16, display: "flex", gap: 8 }}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary small"
                      >
                        View
                      </a>
                      <form action="/api/resources/delete" method="POST">
                        <input type="hidden" name="resourceId" value={resource.id} />
                        <button type="submit" className="button secondary small">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expired resources */}
      {expiredResources.length > 0 && (
        <div>
          <div className="section-title">Expired Resources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {expiredResources.map(resource => (
              <div
                key={resource.id}
                className="card"
                style={{ opacity: 0.6 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h4>{resource.title}</h4>
                      <span className="pill" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}>
                        Expired
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Expired on: {new Date(resource.expiresAt!).toLocaleDateString()}
                    </div>
                  </div>
                  <form action="/api/resources/delete" method="POST">
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <button type="submit" className="button secondary small">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sharedResources.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            No shared resources yet. Share your first resource to make it available to students!
          </p>
        </div>
      )}
    </div>
  );
}
