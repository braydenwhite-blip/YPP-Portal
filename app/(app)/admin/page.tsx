import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getDashboardData } from "@/lib/dashboard/data";
import NextActions from "@/components/dashboard/next-actions";
import QueueBoard from "@/components/dashboard/queue-board";

const MANAGE_LINKS = [
  { label: "Students", href: "/admin/students" },
  { label: "Instructors", href: "/admin/instructors" },
  { label: "Recruiting", href: "/admin/recruiting" },
  { label: "Applications", href: "/admin/applications" },
  { label: "Training", href: "/admin/training" },
  { label: "Mentorship", href: "/admin/mentorship-program" },
  { label: "Events", href: "/admin/events" },
  { label: "Chapters", href: "/admin/chapters" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Feature Gates", href: "/admin/feature-gates" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Export", href: "/admin/export" },
  { label: "Challenges", href: "/admin/challenges" },
  { label: "Incubator", href: "/admin/incubator" },
  { label: "Pathways", href: "/admin/pathways" },
  { label: "Bulk Users", href: "/admin/bulk-users" },
  { label: "Waitlist", href: "/admin/waitlist" },
  { label: "Parent Approvals", href: "/admin/parent-approvals" },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "Hiring Committee", href: "/admin/hiring-committee" },
];

export default async function AdminPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const dashboard = await getDashboardData(session!.user!.id, "ADMIN");

  const todayDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Command Center</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{todayDateLabel}</p>
        </div>
      </div>

      {/* Primary: Next Actions */}
      <NextActions actions={dashboard.nextActions} />

      {/* Secondary: Queue Status */}
      <QueueBoard queues={dashboard.queues} />

      {/* Manage: Quick links to all admin sub-pages */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Manage
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          {MANAGE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "block",
                padding: "10px 12px",
                background: "var(--surface)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--foreground)",
                textDecoration: "none",
                border: "1px solid var(--border)",
                transition: "background 0.15s",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
