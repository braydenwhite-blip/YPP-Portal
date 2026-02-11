import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PortfolioBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Showcase</p>
          <h1 className="page-title">Portfolio Builder</h1>
        </div>
      </div>

      {portfolio && portfolio.items.length > 0 ? (
        <>
          <div className="card" style={{ marginBottom: 28 }}>
            <h3>{portfolio.title}</h3>
            {portfolio.bio && (
              <p style={{ color: "var(--text-secondary)" }}>{portfolio.bio}</p>
            )}
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
              {portfolio.isPublic ? "🌐 Public" : "🔒 Private"} · {portfolio.items.length} item{portfolio.items.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {portfolio.items.map((item) => (
              <div key={item.id} className="card">
                <h4 style={{ marginBottom: 4 }}>{item.title}</h4>
                {item.description && (
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                    {item.description}
                  </p>
                )}
                <span className="pill secondary">{item.type}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "60px 32px" }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>📁</div>
          <h2 style={{ marginBottom: 12 }}>No data yet</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 16px", lineHeight: 1.6 }}>
            This page will let you build a professional portfolio showcasing your best work —
            perfect for college applications, scholarships, and sharing your passion journey.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            Data is added by <strong>you (student)</strong>. Portfolio creation coming soon.
          </p>
          <Link href="/admin" className="button primary">
            Go to Admin Panel
          </Link>
        </div>
      )}
    </div>
  );
}
