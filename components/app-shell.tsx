import Nav from "@/components/nav";

export default function AppShell({
  children,
  userName,
  roles,
  primaryRole
}: {
  children: React.ReactNode;
  userName?: string | null;
  roles?: string[];
  primaryRole?: string | null;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          YPP <span>Pathways</span>
        </div>
        <Nav roles={roles} />
        <div className="sidebar-card">
          <h4>Signed In</h4>
          <p>{userName ?? "Portal User"}</p>
          <p style={{ marginTop: 8, opacity: 0.9 }}>
            {primaryRole ? `Primary Role: ${primaryRole}` : "Role-based dashboards enabled"}
          </p>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
