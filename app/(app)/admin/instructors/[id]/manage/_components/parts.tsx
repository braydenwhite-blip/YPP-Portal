import Link from "next/link";

import {
  completenessTone,
  type InstructorCompleteness,
} from "@/lib/instructor-completeness";

export function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card instructor-ops-metric">
      <span className="kpi" style={{ fontSize: value.length > 8 ? 22 : undefined }}>
        {value}
      </span>
      <span className="kpi-label">{label}</span>
      <span>{detail}</span>
    </div>
  );
}

export function CompletenessBanner({ completeness }: { completeness: InstructorCompleteness }) {
  const tone = completenessTone(completeness.score);
  const palette =
    tone === "success"
      ? { bg: "#f0fdf4", border: "#bbf7d0", fg: "#166534" }
      : tone === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", fg: "#854d0e" }
        : { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" };

  return (
    <section
      className="card"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: palette.fg, minWidth: 64 }}>
        {completeness.score}%
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 600, color: palette.fg }}>Profile completeness</div>
        {completeness.missing.length === 0 ? (
          <div style={{ fontSize: 13, color: palette.fg }}>All tracked fields are on file.</div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: palette.fg,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 4,
            }}
          >
            <span>Missing:</span>
            {completeness.missing.map((m) => (
              <span
                key={m.code}
                style={{
                  padding: "1px 8px",
                  borderRadius: 9999,
                  background: "rgba(0,0,0,0.05)",
                  fontWeight: 600,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="instructor-ops-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="instructor-profile-info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ManageSectionLinks({
  instructorId,
  items,
}: {
  instructorId: string;
  items: Array<{ href: string; title: string; detail: string; count?: number }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={`/admin/instructors/${instructorId}/manage/${item.href}`}
          className="card instructor-profile-section"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>{item.title}</h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{item.detail}</p>
            </div>
            {item.count != null && item.count > 0 ? (
              <span className="pill pill-attention">{item.count}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
