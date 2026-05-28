"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string }[] = [
  { href: "/admin/mentorship/gr", label: "Overview" },
  { href: "/admin/mentorship/gr/templates", label: "Templates" },
  { href: "/admin/mentorship/gr/assignments", label: "Assignments" },
  { href: "/admin/mentorship/gr/resources", label: "Resources" },
];

/**
 * Shared sub-navigation for the canonical admin Goals & Resources area so
 * templates, assignments, resources, and the document overview read as one
 * connected workspace under /admin/mentorship.
 */
export function GRAdminSubnav() {
  const pathname = usePathname() ?? "/admin/mentorship/gr";

  return (
    <nav
      aria-label="Goals & Resources admin sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        margin: "0 0 20px",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link href="/admin/mentorship" className="button ghost small">
        ← Command center
      </Link>
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin/mentorship/gr"
            ? pathname === "/admin/mentorship/gr"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "button small" : "button ghost small"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default GRAdminSubnav;
