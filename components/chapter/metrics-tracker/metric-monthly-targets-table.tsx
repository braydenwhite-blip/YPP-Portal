import { formatMetricValue } from "@/components/chapter/metrics-tracker/metric-performance-chart";
import type { EditableMetricSnapshot } from "@/lib/chapters/metrics-tracker/catalog";

export function MetricMonthlyTargetsTable({ metric }: { metric: EditableMetricSnapshot }) {
  const m = metric.def;
  const months = ["M1", "M2", "M3", "M4", "M5", "M6"];
  return (
    <div className="overflow-x-auto rounded-[12px] border border-line-card bg-surface">
      <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line-card bg-surface-soft">
            <th className="px-3 py-2 font-semibold text-ink-muted">Month</th>
            {months.map((mo) => (
              <th key={mo} className="px-2 py-2 text-center font-semibold text-ink-muted">
                {mo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-2 font-medium text-ink">Expectation</td>
            {months.map((mo, i) => {
              const display = m.targetDisplay?.[i];
              const num = m.monthlyTargets[i];
              const cell =
                display ??
                (m.noTarget || num == null ? "—" : formatMetricValue(m.unit, num));
              return (
                <td key={mo} className="px-2 py-2 text-center tabular-nums text-ink">
                  {cell}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
