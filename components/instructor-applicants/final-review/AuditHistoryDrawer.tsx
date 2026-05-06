"use client";

/**
 * Audit chain renderer (Phase 2E §13). Lists every chair decision and rescind
 * event for an applicant, newest-first, in a single chronological stream.
 *
 * The drawer is the historical record — chairs use it before deciding to
 * understand prior context, and SUPER_ADMINs use it to review their own
 * rescind actions.
 */

import { useMemo, useState } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import type { AuditChain, AuditDecisionEntry, AuditRescindEntry } from "@/lib/final-review-queries";
import { CheckIcon, XIcon, PauseIcon, ClockIcon, HelpCircleIcon, RotateCwIcon, AlertTriangleIcon } from "./cockpit-icons";

type StreamEntry =
  | { kind: "decision"; entry: AuditDecisionEntry; at: number }
  | { kind: "rescind"; entry: AuditRescindEntry; at: number };

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved with conditions",
  REJECT: "Rejected",
  HOLD: "Placed on hold",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Requested info",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

const ACTION_ICON: Record<ChairDecisionAction, (props: { size?: number }) => JSX.Element> = {
  APPROVE: CheckIcon,
  APPROVE_WITH_CONDITIONS: CheckIcon,
  REJECT: XIcon,
  HOLD: PauseIcon,
  WAITLIST: ClockIcon,
  REQUEST_INFO: HelpCircleIcon,
  REQUEST_SECOND_INTERVIEW: RotateCwIcon,
};

const ACTION_TONE: Record<ChairDecisionAction, { fg: string; bg: string }> = {
  APPROVE: { fg: "#15803d", bg: "rgba(22, 163, 74, 0.1)" },
  APPROVE_WITH_CONDITIONS: { fg: "#15803d", bg: "rgba(22, 163, 74, 0.08)" },
  REJECT: { fg: "#b91c1c", bg: "rgba(239, 68, 68, 0.1)" },
  HOLD: { fg: "#a16207", bg: "rgba(234, 179, 8, 0.1)" },
  WAITLIST: { fg: "#a16207", bg: "rgba(234, 179, 8, 0.08)" },
  REQUEST_INFO: { fg: "#1d4ed8", bg: "rgba(59, 130, 246, 0.1)" },
  REQUEST_SECOND_INTERVIEW: { fg: "var(--ypp-purple-700, #5a1da8)", bg: "rgba(107, 33, 200, 0.1)" },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildStream(chain: AuditChain): StreamEntry[] {
  const entries: StreamEntry[] = [
    ...chain.decisions.map<StreamEntry>((d) => ({
      kind: "decision",
      entry: d,
      at: new Date(d.decidedAt).getTime(),
    })),
    ...chain.rescinds.map<StreamEntry>((r) => ({
      kind: "rescind",
      entry: r,
      at: new Date(r.rescindedAt).getTime(),
    })),
  ];
  return entries.sort((a, b) => b.at - a.at);
}

export interface AuditHistoryDrawerProps {
  chain: AuditChain;
  initiallyOpen?: boolean;
}

export default function AuditHistoryDrawer({
  chain,
  initiallyOpen = false,
}: AuditHistoryDrawerProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const stream = useMemo(() => buildStream(chain), [chain]);

  if (stream.length === 0) return null;

  return (
    <section
      className="audit-history-drawer"
      aria-label="Decision audit history"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--ink-default, #1a0533)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-muted, #6b5f7a)",
          }}
        >
          Audit history · {stream.length} entr{stream.length === 1 ? "y" : "ies"}
        </span>
        <span style={{ fontSize: 12, color: "var(--ypp-purple-700, #5a1da8)", fontWeight: 600 }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {stream.map((entry) => (entry.kind === "decision" ? (
            <DecisionRow key={`d-${entry.entry.id}`} decision={entry.entry} />
          ) : (
            <RescindRow key={`r-${entry.entry.id}`} rescind={entry.entry} />
          )))}
        </ol>
      ) : null}
    </section>
  );
}

function DecisionRow({ decision }: { decision: AuditDecisionEntry }) {
  const Icon = ACTION_ICON[decision.action];
  const tone = ACTION_TONE[decision.action];
  const superseded = Boolean(decision.supersededAt);
  return (
    <li
      style={{
        padding: 12,
        borderRadius: 12,
        background: "var(--cockpit-surface-strong, #faf8ff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
        opacity: superseded ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: tone.bg,
            color: tone.fg,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Icon size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
            {ACTION_LABEL[decision.action]}
            {decision.chairName ? ` by ${decision.chairName}` : ""}
            {superseded ? (
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 6px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "rgba(168, 156, 184, 0.2)",
                  color: "var(--ink-muted, #6b5f7a)",
                }}
              >
                Superseded
              </span>
            ) : null}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
            {fmt(decision.decidedAt)}
          </p>
        </div>
      </div>
      {decision.rationale ? (
        <p
          style={{
            margin: "8px 0 0",
            padding: "6px 10px",
            background: "var(--cockpit-surface, #fff)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--ink-default, #1a0533)",
            whiteSpace: "pre-wrap",
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.12))",
          }}
        >
          {decision.rationale}
        </p>
      ) : null}
    </li>
  );
}

function RescindRow({ rescind }: { rescind: AuditRescindEntry }) {
  return (
    <li
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(239, 68, 68, 0.06)",
        border: "1px solid rgba(239, 68, 68, 0.32)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.16)",
            color: "#b91c1c",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <AlertTriangleIcon size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#7f1d1d" }}>
            {rescind.rescindedAction
              ? `${ACTION_LABEL[rescind.rescindedAction]} rescinded`
              : "Decision rescinded"}
            {rescind.actorName ? ` by ${rescind.actorName}` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#991b1b" }}>
            {fmt(rescind.rescindedAt)}
          </p>
        </div>
      </div>
      {rescind.reason ? (
        <p
          style={{
            margin: "8px 0 0",
            padding: "6px 10px",
            background: "var(--cockpit-surface, #fff)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--ink-default, #1a0533)",
            whiteSpace: "pre-wrap",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <ClockIcon size={11} /> {rescind.reason}
        </p>
      ) : null}
    </li>
  );
}
