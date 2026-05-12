import Link from "next/link";

interface ActionLink {
  label: string;
  href: string;
  primary?: boolean;
}

export default function ActionCenterSectionHeader({
  title,
  badge,
  description,
  actions,
}: {
  title: string;
  badge?: string;
  description?: string;
  actions?: ActionLink[];
}) {
  return (
    <div
      className="topbar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        {badge && <p className="badge">{badge}</p>}
        <h1 className="page-title" style={{ marginTop: badge ? 8 : 0 }}>
          {title}
        </h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && actions.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={a.primary ? "button small" : "button outline small"}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
