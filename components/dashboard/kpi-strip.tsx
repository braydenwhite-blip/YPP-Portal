import type { DashboardKpi } from "@/lib/dashboard/types";

export default function KpiStrip({ kpis }: { kpis: DashboardKpi[] }) {
  if (kpis.length === 0) return null;

  return (
    <div className="grid four" style={{ marginBottom: 16 }}>
      {kpis.map((kpi) => (
        <div key={kpi.id} className="card">
          <div className="kpi">{kpi.value}</div>
          <div className="kpi-label">{kpi.label}</div>
          {kpi.note ? (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{kpi.note}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
