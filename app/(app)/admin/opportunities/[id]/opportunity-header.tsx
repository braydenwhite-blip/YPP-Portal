import type { OpportunityCoverage } from "@/lib/instructor-assignment-matching";

type HeaderProps = {
  opportunity: {
    id: string;
    title: string;
    partnerName: string | null;
    type: string;
    status: string;
    urgency: string;
    deliveryMode: string;
    description: string | null;
    locationName: string | null;
    locationCity: string | null;
    locationState: string | null;
    locationCountry: string | null;
    startDate: Date | null;
    endDate: Date | null;
    fillByDate: Date | null;
    slotsNeeded: number;
    ageGroup: string | null;
    topicTags: string[];
    chapter: { id: string; name: string } | null;
    owner: { id: string; name: string | null; email: string | null } | null;
    partnerContactName: string | null;
    partnerContactEmail: string | null;
    partnerContactPhone: string | null;
    internalNotes: string | null;
  };
  coverage: OpportunityCoverage;
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const URGENCY_PILL: Record<string, string> = {
  LOW: "pill pill-declined",
  NORMAL: "pill",
  HIGH: "pill pill-attention",
  URGENT: "pill pill-pending",
};

const STATUS_PILL: Record<string, string> = {
  DRAFT: "pill",
  OPEN: "pill pill-info",
  CONFIRMED: "pill pill-success",
  COMPLETED: "pill pill-declined",
  CANCELLED: "pill pill-attention",
  ARCHIVED: "pill pill-declined",
};

export default function OpportunityHeader({ opportunity, coverage }: HeaderProps) {
  const location = [
    opportunity.locationName,
    opportunity.locationCity,
    opportunity.locationState,
    opportunity.locationCountry,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <p className="badge">{opportunity.type.replace(/_/g, " ").toLowerCase()}</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {opportunity.title}
          </h1>
          <p className="page-subtitle">
            {opportunity.partnerName ?? "No partner set"}
            {opportunity.chapter && ` · ${opportunity.chapter.name}`}
            {opportunity.ageGroup && ` · ${opportunity.ageGroup}`}
          </p>

          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <span className={STATUS_PILL[opportunity.status]}>
              {opportunity.status.toLowerCase()}
            </span>
            <span className={URGENCY_PILL[opportunity.urgency]}>
              {opportunity.urgency.toLowerCase()}
            </span>
            <span className="pill pill-info">{opportunity.deliveryMode.toLowerCase()}</span>
            <span
              className={
                coverage.uncovered
                  ? "pill pill-attention"
                  : coverage.overstaffed
                  ? "pill pill-info"
                  : "pill pill-success"
              }
            >
              {coverage.active}/{coverage.needed} staffed · {coverage.confirmed} confirmed
            </span>
            {opportunity.topicTags.map((tag) => (
              <span key={tag} className="pill pill-small pill-purple">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ flex: "0 1 280px", fontSize: 13, color: "var(--text-secondary)" }}>
          <Detail label="Dates">
            {fmt(opportunity.startDate)} → {fmt(opportunity.endDate)}
          </Detail>
          <Detail label="Fill by">{fmt(opportunity.fillByDate)}</Detail>
          <Detail label="Location">{location || "—"}</Detail>
          <Detail label="Owner">{opportunity.owner?.name ?? "Unassigned"}</Detail>
        </div>
      </div>

      {opportunity.description && (
        <p style={{ marginTop: 16, color: "var(--text-secondary)", fontSize: 14 }}>
          {opportunity.description}
        </p>
      )}

      {(opportunity.partnerContactName ||
        opportunity.partnerContactEmail ||
        opportunity.internalNotes) && (
        <details style={{ marginTop: 16, fontSize: 13 }}>
          <summary style={{ fontWeight: 600, cursor: "pointer" }}>
            Admin-private notes & partner contact
          </summary>
          <div style={{ marginTop: 10, color: "var(--text-secondary)" }}>
            {opportunity.partnerContactName && (
              <Detail label="Contact">{opportunity.partnerContactName}</Detail>
            )}
            {opportunity.partnerContactEmail && (
              <Detail label="Email">{opportunity.partnerContactEmail}</Detail>
            )}
            {opportunity.partnerContactPhone && (
              <Detail label="Phone">{opportunity.partnerContactPhone}</Detail>
            )}
            {opportunity.internalNotes && (
              <Detail label="Notes">
                <span style={{ whiteSpace: "pre-wrap" }}>{opportunity.internalNotes}</span>
              </Detail>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}:{" "}
      </span>
      {children}
    </div>
  );
}
