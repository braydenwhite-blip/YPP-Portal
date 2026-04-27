/**
 * Read-only summary at the top of the confirmation modal. Tells the chair,
 * before they click Confirm: what changes in the system, what the consensus
 * looked like, what's missing on readiness, and what the email will say.
 * (§8.3)
 */

import type {
  ChairDecisionAction,
  InstructorInterviewRecommendation,
} from "@prisma/client";
import {
  type ReadinessSignals,
  readinessSignalLabel,
  readinessPercentage,
} from "@/lib/readiness-signals";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import EmailPreviewSnippet from "./EmailPreviewSnippet";
import { AlertTriangleIcon } from "./cockpit-icons";

const HEADLINE: Record<ChairDecisionAction, (n: string, c: string | null) => string> = {
  APPROVE: (n, c) => `Approve ${n}${c ? ` for the ${c} chapter` : ""}.`,
  REJECT: (n) => `Reject ${n}.`,
  HOLD: (n) => `Place ${n} on hold.`,
  REQUEST_INFO: (n) => `Request more information from ${n}.`,
  REQUEST_SECOND_INTERVIEW: (n) => `Send ${n} back for a second interview.`,
};

const CONSEQUENCES: Record<ChairDecisionAction, string> = {
  APPROVE:
    "Grants the INSTRUCTOR role, enrolls the applicant in training, and sends the approval email.",
  REJECT:
    "Sets the application status to REJECTED and sends a rejection email using the selected reason code.",
  HOLD: "Sets the application status to ON_HOLD. No email is sent automatically.",
  REQUEST_INFO:
    "Sets the application status to INFO_REQUESTED and emails the applicant your follow-up note.",
  REQUEST_SECOND_INTERVIEW:
    "Returns the application to interview scheduling for round 2. Round 1 reviews stay in the audit trail.",
};

export interface DecisionSummaryCardProps {
  action: ChairDecisionAction;
  applicantDisplayName: string;
  chapterName: string | null;
  rationale: string;
  readiness: ReadinessSignals;
  priorDecision: { action: ChairDecisionAction; decidedAt: string } | null;
  consensus: {
    totalReviews: number;
    recommendations: InstructorInterviewRecommendation[];
    redFlagCount: number;
  };
  rejectReasonCode?: string | null;
  rejectFreeText?: string | null;
}

const REC_LABEL: Record<InstructorInterviewRecommendation, string> = {
  ACCEPT: "Accept",
  ACCEPT_WITH_SUPPORT: "Accept w/ support",
  HOLD: "Hold",
  REJECT: "Reject",
};

export default function DecisionSummaryCard(props: DecisionSummaryCardProps) {
  const headline = HEADLINE[props.action](props.applicantDisplayName, props.chapterName);
  const consequence = CONSEQUENCES[props.action];
  const percent = readinessPercentage(props.readiness);
  const gaps = (Object.keys(props.readiness) as Array<keyof ReadinessSignals>)
    .filter((k) => !props.readiness[k])
    .map((k) => readinessSignalLabel(k).gap);

  const counts = props.consensus.recommendations.reduce(
    (acc, rec) => {
      acc[rec] = (acc[rec] ?? 0) + 1;
      return acc;
    },
    {} as Record<InstructorInterviewRecommendation, number>
  );

  return (
    <div
      className="decision-summary-card"
      style={{
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 12,
        padding: 16,
        background: "var(--cockpit-surface, #fff)",
      }}
    >
      <h2
        id="confirm-modal-title"
        style={{ margin: 0, fontSize: 22, lineHeight: 1.25, color: "var(--ink-default, #1a0533)" }}
      >
        {headline}
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-muted, #6b5f7a)", lineHeight: 1.5 }}>
        {consequence}
      </p>
      {props.priorDecision ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
          This supersedes a prior chair decision recorded on{" "}
          {new Date(props.priorDecision.decidedAt).toLocaleDateString()}.
        </p>
      ) : null}
      {percent < 100 && gaps.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: "rgba(234, 179, 8, 0.1)",
            color: "#a16207",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 12,
          }}
        >
          <AlertTriangleIcon size={16} />
          <span>
            Decision readiness is {percent}%. {gaps.join(" · ")}
          </span>
        </div>
      ) : null}
      {props.consensus.totalReviews > 0 ? (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Object.keys(counts) as InstructorInterviewRecommendation[]).map((rec) => (
            <span
              key={rec}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--ink-muted, #6b5f7a)",
              }}
            >
              <RecommendationBadge recommendation={rec} size="sm" />
              ×{counts[rec]}
            </span>
          ))}
          {props.consensus.redFlagCount > 0 ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#b91c1c",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <AlertTriangleIcon size={14} />
              {props.consensus.redFlagCount} red-flag tag
              {props.consensus.redFlagCount > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      <EmailPreviewSnippet
        action={props.action}
        applicantDisplayName={props.applicantDisplayName}
        rationale={props.rationale}
        rejectReasonCode={props.rejectReasonCode ?? null}
        rejectFreeText={props.rejectFreeText ?? null}
      />
    </div>
  );
}
