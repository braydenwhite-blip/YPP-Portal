import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SharedResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get resources shared by this instructor
  const sharedResources = await prisma.resource.findMany({
    where: {
      uploadedById: session.user.id,
      isPublic: true
    },
    include: {
      course: true
    },
    orderBy: { createdAt: "desc" }
  });

  const linkedResources = sharedResources.filter(r => r.courseId !== null).length;
  const generalResources = sharedResources.length - linkedResources;

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
          <div className="kpi">{sharedResources.length}</div>
          <div className="kpi-label">Total Shared</div>
        </div>
        <div className="card">
          <div className="kpi">{linkedResources}</div>
          <div className="kpi-label">Linked to Course</div>
        </div>
        <div className="card">
          <div className="kpi">{generalResources}</div>
          <div className="kpi-label">General Resources</div>
        </div>
      </div>

      {sharedResources.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Shared Resources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sharedResources.map(resource => (
              <div key={resource.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3>{resource.title}</h3>
                      <span className="pill success">Public</span>
                      <span className="pill">{resource.type}</span>
                    </div>

                    {resource.description && (
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                        {resource.description}
                      </p>
                    )}

                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {resource.course ? `Course: ${resource.course.title} • ` : ""}
                      Created {new Date(resource.createdAt).toLocaleDateString()}
                    </div>
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
