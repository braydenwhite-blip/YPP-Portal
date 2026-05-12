"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/action-center", label: "Overview" },
  { href: "/admin/action-center/tasks", label: "Tasks" },
  { href: "/admin/action-center/weekly", label: "Weekly Digest" },
  { href: "/admin/action-center/meetings", label: "Meetings" },
  { href: "/admin/action-center/import", label: "Import" },
];

export default function ActionCenterSubNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Leadership Action Center sections"
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 24,
        borderBottom: "1px solid #e2e8f0",
        flexWrap: "wrap",
      }}
    >
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/admin/action-center"
            ? pathname === tab.href
            : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "10px 16px",
              borderBottom: isActive
                ? "2px solid var(--ypp-primary-brand, #6b21c8)"
                : "2px solid transparent",
              color: isActive ? "var(--ypp-purple-800, #3b0f6e)" : "var(--muted, #64748b)",
              fontWeight: isActive ? 600 : 500,
              textDecoration: "none",
              fontSize: 14,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
