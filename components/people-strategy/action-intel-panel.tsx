import Link from "next/link";

import { CardV2 } from "@/components/ui-v2";

import type {
  ActionLabel,
  ActionLabelTone,
  ActionNextMove,
  ActionUrgency,
} from "@/lib/people-strategy/action-intel";
import type {
  ActionSourceDescriptor,
  ActionStrategicLinkage,
} from "@/lib/people-strategy/action-source";

/**
 * Action System 4.0 — the per-action "what matters now" panel. Purely
 * presentational (server component): the detail page computes the pure
 * derivations and passes them in, so this renders honest copy without any logic.
 */

const TONE_COLOR: Record<ActionLabelTone, string> = {
  good: "var(--success, #1a7f37)",
  warn: "var(--warning, #9a6700)",
  danger: "var(--danger, #b42318)",
  info: "var(--muted)",
};

function LabelChip({ label }: { label: ActionLabel }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${TONE_COLOR[label.tone]}`,
        color: TONE_COLOR[label.tone],
        whiteSpace: "nowrap",
      }}
    >
      {label.text}
    </span>
  );
}

export function ActionIntelPanel({
  nextMove,
  labels,
  source,
  linkage,
  urgency,
  ctaHref,
  meetingHref,
}: {
  nextMove: ActionNextMove;
  labels: ActionLabel[];
  source: ActionSourceDescriptor;
  linkage: ActionStrategicLinkage;
  urgency: ActionUrgency;
  ctaHref: string;
  meetingHref?: string | null;
}) {
  return (
    <CardV2 as="section" padding="md" className="mt-4">
      {labels.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {labels.map((l) => (
            <LabelChip key={l.key} label={l} />
          ))}
        </div>
      )}

      <h2 className="ps-section-title" style={{ margin: "0 0 4px" }}>
        What matters now
      </h2>
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>{nextMove.move}</p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{nextMove.why}</p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
        <span style={{ fontWeight: 600 }}>If nothing changes: </span>
        {nextMove.ifIgnored}
      </p>
      <div style={{ marginTop: 10 }}>
        <Link
          href={ctaHref}
          className="inline-flex h-8 items-center justify-center rounded-[8px] bg-brand-600 px-3 text-[12.5px] font-semibold text-white hover:bg-brand-700"
        >
          {nextMove.ctaLabel}
        </Link>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>Created from: </span>
          <span>{source.label}</span>
          {!source.explicit && (
            <span style={{ color: "var(--muted)" }}> (inferred)</span>
          )}
          {source.type === "MEETING" || source.type === "MEETING_DECISION" ? (
            meetingHref ? (
              <>
                {" · "}
                <Link href={meetingHref}>Back to meeting</Link>
              </>
            ) : null
          ) : null}
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{source.why}</p>
        </div>

        <div style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>Linked goal: </span>
          {linkage.hasExplicitLink ? (
            <span>
              {linkage.initiativeHref && linkage.initiativeTitle ? (
                <Link href={linkage.initiativeHref}>{linkage.initiativeTitle}</Link>
              ) : null}
              {linkage.projectHref && linkage.projectTitle ? (
                <>
                  {linkage.initiativeTitle ? " › " : ""}
                  <Link href={linkage.projectHref}>{linkage.projectTitle}</Link>
                </>
              ) : null}
              <span style={{ color: "var(--muted)" }}> · explicitly linked</span>
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>
              Not linked to a project or initiative.{" "}
              <span style={{ fontSize: 12 }}>
                Urgency: {urgency.label.toLowerCase()}.
              </span>
            </span>
          )}
        </div>
      </div>
    </CardV2>
  );
}
