import Link from "next/link";

import { EntityLink } from "@/components/operations/entity-link";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { RELATED_TO_ENTITY_360 } from "@/lib/operations/entity-360";
import { relatedEntityTypeLabel } from "@/lib/people-strategy/constants";
import {
  meetingCategoryLabel,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import type { OperationalHealth } from "@/lib/people-strategy/operational-context";

import { Pill, type PillTone } from "./pills";

/**
 * Cross-portal operational badges — the small, reusable visual atoms that make
 * meetings, actions, and follow-ups read as one connected system. Server-safe
 * (no "use client"); every tone routes through the design-system `.pill.*`
 * classes so colors stay tokenized. Used on action cards / detail, meeting
 * detail, and the OperationalContextPanel so the same fact always looks the same.
 */

/**
 * The YPP entity an item is about (a class / mentorship / person / …). Shows the
 * type and, when known, the entity's own name. When the entity has a 360 panel
 * (class / partner / person) and an `id` is supplied, clicking opens the panel
 * in place; otherwise it links to the entity's page when one exists. Quiet
 * neutral tone so it labels without competing with status.
 */
export function RelatedEntityBadge({
  type,
  id = null,
  label,
  href = null,
}: {
  type: string;
  id?: string | null;
  label?: string | null;
  href?: string | null;
}) {
  const typeLabel = relatedEntityTypeLabel(type);
  const text = label ? `${typeLabel} · ${label}` : typeLabel;
  const inner = <Pill tone="info">{text}</Pill>;
  const drawerType = id ? RELATED_TO_ENTITY_360[type] : undefined;
  if (drawerType && id) {
    return (
      <EntityLink type={drawerType} id={id} href={href ?? undefined} title={`Open ${typeLabel}`}>
        {inner}
      </EntityLink>
    );
  }
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }} title={`Open ${typeLabel}`}>
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * The meeting an action / follow-up was generated from. Purple "Source: …" pill
 * that links back to the meeting workspace — the reverse of the meeting's link to
 * its actions, so the two directions always agree.
 */
export function SourceMeetingBadge({
  id,
  title,
  dateISO,
  compact = false,
}: {
  id: string;
  title?: string | null;
  dateISO?: string | null;
  compact?: boolean;
}) {
  const name = title?.trim() || "Meeting";
  const date = dateISO ? formatMonthDay(new Date(dateISO)) : null;
  return (
    <Link href={`/meetings/${id}`} style={{ textDecoration: "none" }} title="Open source meeting">
      <Pill tone="purple">
        {compact ? "Source: Meeting" : `Source: ${name}${date ? ` · ${date}` : ""}`}
      </Pill>
    </Link>
  );
}

/** The YPP operating area (meeting category) with its identity icon + tone. */
export function AreaBadge({ area }: { area: string | null | undefined }) {
  if (!area) return null;
  const tone = meetingCategoryTone(area);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
        whiteSpace: "nowrap",
      }}
    >
      {meetingCategoryLabel(area)}
    </span>
  );
}

const HEALTH_DOT: Record<OperationalHealth["tone"], string> = {
  success: "var(--success-color, #16a34a)",
  info: "var(--ypp-purple-600, #6d28d9)",
  warning: "var(--warning-color, #d97706)",
  overdue: "var(--error-color, #dc2626)",
};

/**
 * The four-step operating-health read for a surface. A colored dot + label, with
 * the contributing reasons as a hover title and (optionally) an inline summary.
 */
export function OperationalHealthBadge({
  health,
  withReasons = false,
}: {
  health: OperationalHealth;
  withReasons?: boolean;
}) {
  const reasons = health.reasons.join(" · ");
  return (
    <span
      title={reasons || health.label}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <Pill tone={health.tone}>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: HEALTH_DOT[health.tone],
            marginRight: 5,
            verticalAlign: "0px",
          }}
        />
        {health.label}
      </Pill>
      {withReasons && reasons ? (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{reasons}</span>
      ) : null}
    </span>
  );
}

type MeetingOutcomeLevel =
  | "strong"
  | "adequate"
  | "needs_follow_through"
  | "empty"
  | "stale";

type MeetingOutcomeTone = "success" | "info" | "warning" | "neutral" | "overdue";

export type MeetingOutcomeQuality = {
  level: MeetingOutcomeLevel;
  headline: string;
  reasons?: string[];
  suggestedNextSteps?: string[];
};

const MEETING_OUTCOME_META: Record<MeetingOutcomeLevel, { label: string; tone: MeetingOutcomeTone }> = {
  stale: { label: "Stale", tone: "overdue" },
  needs_follow_through: { label: "Needs follow-through", tone: "warning" },
  empty: { label: "No outcome yet", tone: "neutral" },
  adequate: { label: "Adequate", tone: "info" },
  strong: { label: "Strong outcome", tone: "success" },
};

function meetingOutcomeMeta(level: MeetingOutcomeLevel) {
  return MEETING_OUTCOME_META[level];
}

const OUTCOME_PILL_TONE: Record<MeetingOutcomeTone, PillTone> = {
  success: "success",
  info: "info",
  warning: "warning",
  overdue: "overdue",
  neutral: "neutral",
};

/**
 * Did this meeting actually produce useful output? A tone-keyed pill (Strong →
 * Stale) with the deterministic headline as a hover title and (optionally) an
 * inline reason. Used on the meeting detail sidebar, the Command Center / Weekly
 * Review follow-through cards, and anywhere a meeting needs an at-a-glance read.
 */
export function MeetingOutcomeBadge({
  outcome,
  withHeadline = false,
}: {
  outcome: MeetingOutcomeQuality;
  withHeadline?: boolean;
}) {
  const m = meetingOutcomeMeta(outcome.level);
  return (
    <span
      title={outcome.headline}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <Pill tone={OUTCOME_PILL_TONE[m.tone]}>{m.label}</Pill>
      {withHeadline ? (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{outcome.headline}</span>
      ) : null}
    </span>
  );
}
