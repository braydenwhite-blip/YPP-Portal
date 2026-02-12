import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PortfolioItemType } from "@prisma/client";
import {
  createOrUpdatePortfolio,
  addPortfolioItem,
  deletePortfolioItem,
} from "@/lib/portfolio-actions";

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

      {/* Portfolio settings form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>{portfolio ? "Edit Portfolio" : "Create Your Portfolio"}</h3>
        <form action={createOrUpdatePortfolio} className="form-grid">
          <label className="form-row">
            Portfolio Title
            <input
              className="input"
              name="title"
              required
              defaultValue={portfolio?.title ?? ""}
              placeholder="e.g., My Passion Projects"
            />
          </label>
          <label className="form-row">
            Bio
            <textarea
              className="input"
              name="bio"
              rows={2}
              defaultValue={portfolio?.bio ?? ""}
              placeholder="A short description of yourself and your interests..."
            />
          </label>
          <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="isPublic" defaultChecked={portfolio?.isPublic ?? false} />
            Make portfolio public
          </label>
          <button className="button" type="submit">
            {portfolio ? "Update Portfolio" : "Create Portfolio"}
          </button>
        </form>
      </div>

      {/* Add item form (only if portfolio exists) */}
      {portfolio && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Add Portfolio Item</h3>
          <form action={addPortfolioItem} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required placeholder="e.g., Science Fair Project" />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={2} placeholder="What is this project about?" />
            </label>
            <label className="form-row">
              Type
              <select className="input" name="type" defaultValue={PortfolioItemType.PROJECT}>
                {Object.values(PortfolioItemType).map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              URL (optional)
              <input className="input" name="url" type="url" placeholder="https://..." />
            </label>
            <button className="button" type="submit">Add Item</button>
          </form>
        </div>
      )}

      {/* Existing items */}
      {portfolio && portfolio.items.length > 0 && (
        <>
          <h3 style={{ marginBottom: 16 }}>
            Your Items ({portfolio.items.length})
            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-secondary)", marginLeft: 8 }}>
              {portfolio.isPublic ? "Public" : "Private"}
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {portfolio.items.map((item) => (
              <div key={item.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4 style={{ marginBottom: 4 }}>{item.title}</h4>
                  {item.description && (
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {item.description}
                    </p>
                  )}
                  <span className="pill secondary">{item.type}</span>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 13, marginLeft: 12 }}>
                      View
                    </a>
                  )}
                </div>
                <form action={deletePortfolioItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="button small secondary" type="submit">Remove</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      {!portfolio && (
        <div className="card" style={{ textAlign: "center", padding: "40px 32px", color: "var(--text-secondary)" }}>
          <p>Create your portfolio above to start adding items.</p>
        </div>
      )}
    </div>
  );
}
