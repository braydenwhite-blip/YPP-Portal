import Link from "next/link";
import { Meter } from "@/components/people-strategy/people-suite";
import { PublicClassStatusBadge } from "@/components/classes/public-class-status-badge";
import {
  derivePublicClassStatus,
  formatScheduleSummary,
  type OfferingStatus,
} from "@/lib/class-status";

/**
 * Polished, reusable catalog card for a public `ClassOffering`. Pure (server-
 * renderable) and decoupled from the Prisma row shape — the page maps an offering
 * into `ClassCardData`. Replaces the bespoke inline card markup so the catalog,
 * recommendations, and any future class grid stay visually and behaviourally
 * identical, and so the status badge / capacity meter always agree with the
 * single source of truth in `lib/class-status.ts`.
 */

export interface ClassCardData {
  id: string;
  title: string;
  description: string;
  interestArea: string;
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  learnerFitLabel: string;
  learnerFitAccent: string;
  learnerFitDescription: string;
  instructorName: string;
  startDate: Date | string;
  endDate: Date | string;
  meetingDays: string[];
  meetingTime: string;
  sessionCount?: number | null;
  locationName?: string | null;
  locationAddress?: string | null;
  capacity: number;
  enrolledCount: number;
  enrollmentOpen: boolean;
  offeringStatus?: OfferingStatus | null;
  introVideoUrl?: string | null;
  chapterLabel?: string | null;
  isPartnerChapter?: boolean;
  pathway?: { id: string; name: string; stepOrder: number } | null;
  fallbackPathways?: { id: string; name: string }[];
  learningOutcomes?: string[];
  /** Recommendation reason chip, when shown on a recommendations row. */
  reasonLabel?: string | null;
  /** The viewer's own enrollment state in this class, if any. */
  myStatus?: "ENROLLED" | "WAITLISTED" | null;
}

const DELIVERY_LABEL: Record<ClassCardData["deliveryMode"], string> = {
  VIRTUAL: "Online",
  IN_PERSON: "In person",
  HYBRID: "Hybrid",
};

export function ClassCard({ data }: { data: ClassCardData }) {
  const status = derivePublicClassStatus({
    status: data.offeringStatus,
    enrollmentOpen: data.enrollmentOpen,
    capacity: data.capacity,
    enrolledCount: data.enrolledCount,
    startDate: data.startDate,
    endDate: data.endDate,
  });

  const href = `/curriculum/${data.id}`;
  const meterTone =
    status.status === "FULL_WAITLIST"
      ? "danger"
      : status.status === "ALMOST_FULL"
        ? "warning"
        : "success";

  const schedule = formatScheduleSummary({
    sessionCount: data.sessionCount,
    meetingDays: data.meetingDays,
    meetingTime: data.meetingTime,
    startDate: data.startDate,
    endDate: data.endDate,
  });

  return (
    <div
      className="card class-card"
      style={{ borderTop: `3px solid ${data.learnerFitAccent}`, display: "flex", flexDirection: "column" }}
    >
      {/* Header: title + live status */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <h3 style={{ margin: 0, lineHeight: 1.3 }}>
          <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
            {data.title}
          </Link>
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "end", flexShrink: 0 }}>
          {data.myStatus === "ENROLLED" ? (
            <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 11 }}>
              ✓ Enrolled
            </span>
          ) : data.myStatus === "WAITLISTED" ? (
            <span className="pill" style={{ background: "#fffbeb", color: "#b45309", fontWeight: 600, fontSize: 11 }}>
              On waitlist
            </span>
          ) : (
            <PublicClassStatusBadge info={status} />
          )}
        </div>
      </div>

      {/* Tag row */}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          className="pill"
          style={{ background: data.learnerFitAccent + "18", color: data.learnerFitAccent, fontWeight: 600 }}
        >
          {data.learnerFitLabel}
        </span>
        <span className="pill">{data.interestArea}</span>
        <span className="pill">{DELIVERY_LABEL[data.deliveryMode]}</span>
        {data.chapterLabel ? <span className="pill">{data.chapterLabel}</span> : null}
        {data.isPartnerChapter ? (
          <span className="pill pill-info" title="Runs through a partner chapter">Partner chapter</span>
        ) : null}
        {data.introVideoUrl ? <span className="pill pill-info">Intro video</span> : null}
        {data.reasonLabel ? <span className="pill pill-info">{data.reasonLabel}</span> : null}
      </div>

      {/* Summary */}
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 10, marginBottom: 0 }}>
        {data.description.slice(0, 120)}
        {data.description.length > 120 ? "…" : ""}
      </p>

      {/* Who / when */}
      <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
        <div>
          <span aria-hidden="true">🎓</span>{" "}
          <span style={{ color: "var(--text-primary, inherit)", fontWeight: 500 }}>{data.instructorName}</span>
          <span style={{ color: "var(--gray-400, #9ca3af)" }}> · student instructor</span>
        </div>
        <div><span aria-hidden="true">🗓️</span> {schedule}</div>
        {data.locationName ? (
          <div>
            <span aria-hidden="true">📍</span> {data.locationName}
            {data.locationAddress ? ` · ${data.locationAddress}` : ""}
          </div>
        ) : null}
      </div>

      {/* Capacity */}
      <div style={{ marginTop: 12 }}>
        <Meter value={data.enrolledCount} max={Math.max(1, data.capacity)} tone={meterTone} />
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>{data.enrolledCount} / {data.capacity} enrolled</span>
          {status.helper ? <span>{status.helper}</span> : null}
        </div>
      </div>

      {/* Outcomes */}
      {data.learningOutcomes && data.learningOutcomes.length > 0 ? (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>You'll learn to:</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {data.learningOutcomes.slice(0, 3).map((outcome, i) => (
              <li key={i}>{outcome}</li>
            ))}
            {data.learningOutcomes.length > 3 ? (
              <li style={{ color: "var(--ypp-purple)" }}>+{data.learningOutcomes.length - 3} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Footer: pathway links + primary CTA */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.pathway ? (
            <Link
              href={`/pathways/${data.pathway.id}`}
              className="pill"
              style={{
                background: "var(--ypp-purple-100, #f0e6ff)",
                color: "var(--ypp-purple, #6b21c8)",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 11,
              }}
            >
              Step {data.pathway.stepOrder} · {data.pathway.name}
            </Link>
          ) : (
            (data.fallbackPathways ?? []).slice(0, 1).map((pw) => (
              <Link
                key={pw.id}
                href={`/pathways/${pw.id}`}
                className="pill"
                style={{
                  background: "var(--ypp-purple-100, #f0e6ff)",
                  color: "var(--ypp-purple, #6b21c8)",
                  fontWeight: 600,
                  textDecoration: "none",
                  fontSize: 11,
                }}
              >
                {pw.name} pathway
              </Link>
            ))
          )}
        </div>
        <Link href={href} className="button primary" style={{ fontSize: 13 }}>
          {data.myStatus ? "View class" : status.canSignUp ? "View & sign up" : "View class"} →
        </Link>
      </div>
    </div>
  );
}
