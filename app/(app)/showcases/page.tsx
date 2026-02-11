import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

export default async function ShowcasesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const showcases = await prisma.passionShowcase.findMany({
    include: {
      presentations: { select: { id: true } },
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  if (showcases.length === 0) {
    return (
      <EmptyState
        icon="🎭"
        badge="Showcases"
        title="Passion Showcases"
        description="This page will show quarterly showcase events where students present their passion projects, get feedback, and celebrate achievements with the community."
        addedBy="admins and chapter leaders"
        actionLabel="Go to Admin Panel"
        actionHref="/admin"
      />
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Showcases</p>
          <h1 className="page-title">Passion Showcases</h1>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {showcases.map((showcase) => (
          <div key={showcase.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{showcase.title}</h3>
                {showcase.description && (
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{showcase.description}</p>
                )}
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  📅 {new Date(showcase.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  {showcase.location && ` · 📍 ${showcase.location}`}
                </div>
              </div>
              <span className="pill secondary">{showcase.status}</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {showcase.presentations.length} presentation{showcase.presentations.length !== 1 ? "s" : ""}
              {showcase.maxPresenters != null && ` / ${showcase.maxPresenters} max`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
