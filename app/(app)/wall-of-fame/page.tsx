import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

export default async function WallOfFamePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const entries = await prisma.wallOfFame.findMany({
    where: { isActive: true },
    include: { student: { select: { name: true } } },
    orderBy: { displayOrder: "asc" },
    take: 20,
  });

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="🌟"
        badge="Recognition"
        title="Wall of Fame"
        description="This page will celebrate extraordinary achievements from YPP students — accomplishments that inspire the entire community to pursue their passions."
        addedBy="admins and chapter leaders"
        actionLabel="Manage Wall of Fame"
        actionHref="/admin/wall-of-fame"
      />
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Wall of Fame</h1>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {entries.map((entry, index) => (
          <div key={entry.id} className="card" style={{
            border: index < 3 ? "2px solid var(--primary-color)" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <div>
                <h2 style={{ marginBottom: 4, fontSize: 24 }}>{entry.achievement}</h2>
                <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 4 }}>
                  by {entry.student.name}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {new Date(entry.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
              </div>
              {entry.mediaUrl && (
                <div style={{ fontSize: 48 }}>{entry.mediaUrl}</div>
              )}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>{entry.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
