import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { NAV_CATALOG } from "@/lib/navigation/catalog";
import type { NavGroup, NavLink } from "@/lib/navigation/types";

export const metadata: Metadata = {
  title: "Full Portal",
  description: "Every page in the YPP portal, in one place.",
};

/**
 * Full Portal directory — a single page that links to every destination in the
 * navigation catalog, grouped by section. Unlike the sidebar (which tailors the
 * link set to each role and hides most surfaces behind the role-minimal chrome),
 * this page intentionally surfaces everything so there is always one clear,
 * complete way to reach any part of the portal.
 */
function buildGroupedCatalog(): { group: NavGroup; items: NavLink[] }[] {
  const order: NavGroup[] = [];
  const byGroup = new Map<NavGroup, NavLink[]>();
  const seenHref = new Set<string>();

  for (const link of NAV_CATALOG) {
    // Collapse duplicate hrefs (a few labels point at the same destination).
    if (seenHref.has(link.href)) continue;
    seenHref.add(link.href);

    if (!byGroup.has(link.group)) {
      byGroup.set(link.group, []);
      order.push(link.group);
    }
    byGroup.get(link.group)!.push(link);
  }

  return order.map((group) => ({
    group,
    items: (byGroup.get(group) ?? []).sort((a, b) => a.priority - b.priority),
  }));
}

export default async function SiteMapPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const grouped = buildGroupedCatalog();
  const totalLinks = grouped.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div style={{ maxWidth: 1100, margin: "48px auto 96px", padding: "0 24px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>Full Portal</h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Every part of the portal, in one place — {totalLinks} destinations across{" "}
          {grouped.length} sections. Pick any link to jump straight there.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {grouped.map((section) => (
          <section key={section.group}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--muted)",
                margin: "0 0 12px",
              }}
            >
              {section.group}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 8,
              }}
            >
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
                    {item.icon}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.href}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
