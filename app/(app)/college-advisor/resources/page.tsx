import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getCollegeResources } from "@/lib/college-advisor-scheduling";
import Link from "next/link";

export const metadata = { title: "Resource Library — College Advisor" };

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  SCHOLARSHIP: { label: "Scholarships", emoji: "💰", color: "#16a34a" },
  APPLICATION_TIPS: { label: "Application Tips", emoji: "📝", color: "#2563eb" },
  ESSAY_WRITING: { label: "Essay Writing", emoji: "✍️", color: "#6b21c8" },
  FINANCIAL_AID: { label: "Financial Aid", emoji: "🏦", color: "#0891b2" },
  CAMPUS_LIFE: { label: "Campus Life", emoji: "🏫", color: "#d97706" },
  CAREER_PLANNING: { label: "Career Planning", emoji: "💼", color: "#4338ca" },
  TEST_PREP: { label: "Test Prep", emoji: "📊", color: "#dc2626" },
  RECOMMENDATION_LETTERS: { label: "Rec Letters", emoji: "📬", color: "#059669" },
};

export default async function ResourceLibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const resources = await getCollegeResources();
  const featured = resources.filter((r) => r.isFeatured);
  const byCategory = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
    category: key,
    ...cfg,
    resources: resources.filter((r) => r.category === key),
  })).filter((c) => c.resources.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Resource Library</h1>
          <p className="page-subtitle">
            {resources.length} resources shared by college advisors
          </p>
        </div>
        <Link href="/college-advisor" className="button ghost small">
          ← Back
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📚</div>
          <p style={{ fontWeight: 600 }}>No resources yet</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            College advisors will share helpful resources here soon.
          </p>
        </div>
      ) : (
        <>
          {/* Featured */}
          {featured.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p className="section-title" style={{ marginBottom: "0.75rem" }}>Featured Resources</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {featured.map((r) => {
                  const catCfg = CATEGORY_CONFIG[r.category];
                  return (
                    <div
                      key={r.id}
                      className="card"
                      style={{ borderLeft: `4px solid ${catCfg?.color ?? "var(--border)"}` }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>{r.title}</p>
                        <span className="pill" style={{ fontSize: "0.7rem", background: "var(--surface-alt)" }}>
                          {catCfg?.emoji} {catCfg?.label}
                        </span>
                      </div>
                      {r.description && (
                        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 0.5rem", lineHeight: 1.5 }}>
                          {r.description}
                        </p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ color: "var(--muted)", fontSize: "0.72rem", margin: 0 }}>
                          By {r.advisorName}
                        </p>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="button primary small">
                            Open
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By Category */}
          {byCategory.map((cat) => (
            <div key={cat.category} style={{ marginBottom: "1.5rem" }}>
              <p className="section-title" style={{ marginBottom: "0.75rem" }}>
                {cat.emoji} {cat.label} ({cat.resources.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {cat.resources.map((r) => (
                  <div
                    key={r.id}
                    className="card"
                    style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.9rem" }}>{r.title}</p>
                      {r.description && (
                        <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.15rem 0 0" }}>
                          {r.description}
                        </p>
                      )}
                      <p style={{ color: "var(--muted)", fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
                        By {r.advisorName} · {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="button outline small" style={{ flexShrink: 0 }}>
                        Open
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
