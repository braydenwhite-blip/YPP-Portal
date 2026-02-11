import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  badge: string;
  title: string;
  description: string;
  addedBy: string;
  actionLabel: string;
  actionHref: string;
}

export default function EmptyState({
  icon,
  badge,
  title,
  description,
  addedBy,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">{badge}</p>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "60px 32px" }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>{icon}</div>
        <h2 style={{ marginBottom: 12 }}>No data yet</h2>
        <p style={{
          color: "var(--text-secondary)",
          maxWidth: 480,
          margin: "0 auto 16px",
          lineHeight: 1.6,
        }}>
          {description}
        </p>
        <p style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 24,
        }}>
          Data is added by <strong>{addedBy}</strong>.
        </p>
        <Link href={actionHref} className="button primary">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
