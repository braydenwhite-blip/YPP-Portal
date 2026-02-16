import type { DashboardRole } from "@/lib/dashboard/types";

export default function RoleHero({
  role,
  title,
  subtitle,
}: {
  role: DashboardRole;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="badge" style={{ marginBottom: 8 }}>
        {role.replace(/_/g, " ")}
      </p>
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--muted)" }}>{subtitle}</p>
    </div>
  );
}
