import Link from "next/link";
import type { DashboardNextAction } from "@/lib/dashboard/types";

export default function NextActions({ actions }: { actions: DashboardNextAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Next Actions</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {actions.map((action) => (
          <div
            key={action.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{action.title}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{action.detail}</p>
            </div>
            <Link href={action.href} className="link">
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
