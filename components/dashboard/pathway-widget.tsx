import Link from "next/link";
import type { ActivePathwaySummary } from "@/lib/dashboard/types";

interface PathwayWidgetProps {
  pathways: ActivePathwaySummary[];
}

export default function PathwayWidget({ pathways }: PathwayWidgetProps) {
  if (pathways.length === 0) {
    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>My Pathways</h3>
          <Link href="/pathways" className="button outline small">Browse Pathways</Link>
        </div>
        <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
          You haven&apos;t joined any pathways yet. Browse available pathways to start your structured learning journey.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>My Pathways</h3>
        <Link href="/pathways" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          View all →
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {pathways.map((pathway) => (
          <div key={pathway.id} style={{ borderBottom: "1px solid var(--gray-100, #f7fafc)", paddingBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <Link
                  href={`/pathways/${pathway.id}`}
                  style={{ fontWeight: 600, fontSize: 15, color: "inherit", textDecoration: "none" }}
                >
                  {pathway.name}
                </Link>
                <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>{pathway.interestArea}</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: pathway.progressPercent === 100 ? "var(--green-600, #276749)" : "var(--ypp-purple)" }}>
                {pathway.progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: "var(--gray-200, #e2e8f0)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
              <div
                style={{
                  height: "100%",
                  width: `${pathway.progressPercent}%`,
                  background: pathway.progressPercent === 100 ? "var(--green-500, #48bb78)" : "var(--ypp-purple)",
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                {pathway.completedCount} / {pathway.totalCount} steps
                {pathway.nextStepTitle && pathway.progressPercent < 100 && (
                  <> · Next: {pathway.nextStepTitle}</>
                )}
                {pathway.progressPercent === 100 && " · Complete!"}
              </span>
              {pathway.progressPercent < 100 ? (
                <Link href={`/pathways/${pathway.id}`} className="button outline small" style={{ fontSize: 12 }}>
                  Continue
                </Link>
              ) : (
                <Link href={`/pathways/${pathway.id}/certificate`} className="button small" style={{ fontSize: 12 }}>
                  Certificate
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
