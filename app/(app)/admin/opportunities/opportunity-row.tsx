import Link from "next/link";
import type { OpportunityListItem } from "@/lib/workshop-opportunity-queries";

const STATUS_PILL: Record<OpportunityListItem["status"], string> = {
  DRAFT: "pill",
  OPEN: "pill pill-info",
  CONFIRMED: "pill pill-success",
  COMPLETED: "pill pill-declined",
  CANCELLED: "pill pill-attention",
  ARCHIVED: "pill pill-declined",
};

const URGENCY_PILL: Record<OpportunityListItem["urgency"], string> = {
  LOW: "pill pill-declined",
  NORMAL: "pill",
  HIGH: "pill pill-attention",
  URGENT: "pill pill-pending",
};

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "—";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) {
    if (start.toDateString() === end.toDateString()) return fmt(start);
    return `${fmt(start)} → ${fmt(end)}`;
  }
  return fmt((start ?? end) as Date);
}

export default function OpportunityRow({ row }: { row: OpportunityListItem }) {
  const location = [row.locationCity, row.locationState].filter(Boolean).join(", ") || null;
  const coverageLabel = `${row.coverage.active}/${row.coverage.needed} staffed`;

  return (
    <tr>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Link
            href={`/admin/opportunities/${row.id}`}
            style={{ fontWeight: 600, color: "var(--text-primary)" }}
          >
            {row.title}
          </Link>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {row.partnerName ?? "No partner set"}
            {row.ageGroup ? ` · ${row.ageGroup}` : ""}
          </span>
          {row.topicTags.length > 0 && (
            <span style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {row.topicTags.slice(0, 4).map((tag) => (
                <span key={tag} className="pill pill-small">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </td>
      <td>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {row.type.replace(/_/g, " ").toLowerCase()}
          <br />
          {row.deliveryMode === "VIRTUAL"
            ? "Online"
            : location ?? row.deliveryMode.toLowerCase()}
        </div>
      </td>
      <td>
        <div style={{ fontSize: 12 }}>
          {formatDateRange(row.startDate, row.endDate)}
          {row.fillByDate && (
            <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
              Fill by {row.fillByDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
        </div>
      </td>
      <td>
        <span
          className={
            row.coverage.uncovered
              ? "pill pill-attention"
              : row.coverage.overstaffed
              ? "pill pill-info"
              : "pill pill-success"
          }
        >
          {coverageLabel}
        </span>
      </td>
      <td>
        <span className={URGENCY_PILL[row.urgency]}>{row.urgency.toLowerCase()}</span>
      </td>
      <td>
        <span className={STATUS_PILL[row.status]}>{row.status.toLowerCase()}</span>
      </td>
      <td style={{ textAlign: "right" }}>
        <Link href={`/admin/opportunities/${row.id}`} className="button small outline">
          Manage →
        </Link>
      </td>
    </tr>
  );
}
