/**
 * Presentational helpers for the /my-growth command center. Server components
 * (no client JS) — small, reusable pieces so the page file stays readable.
 */

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: "0 0 2px", fontSize: 18 }}>{title}</h2>
      {subtitle ? (
        <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>{subtitle}</p>
      ) : (
        <div style={{ height: 8 }} />
      )}
      {children}
    </section>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 8,
        borderRadius: 999,
        background: "var(--border, #e5e7eb)",
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          background: "var(--accent, #4f46e5)",
          transition: "width .2s ease",
        }}
      />
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="card"
      style={{ padding: "8px 14px", textAlign: "center", minWidth: 84 }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

export function SignalRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "good" | "grow";
}) {
  if (!items || items.length === 0) return null;
  const bg =
    tone === "good"
      ? "var(--success-bg, #ecfdf5)"
      : tone === "grow"
      ? "var(--warning-bg, #fffbeb)"
      : "var(--chip-bg, #f3f4f6)";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 130 }}>{label}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {items.map((item) => (
          <span
            key={item}
            style={{
              background: bg,
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 13,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
