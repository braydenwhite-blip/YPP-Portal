/**
 * Read-only email preview rendered inside the confirmation modal so chairs
 * can see what message will land in the candidate's inbox before they
 * commit. (§8.7)
 */

import type { ChairDecisionAction } from "@prisma/client";

export interface EmailPreviewSnippetProps {
  action: ChairDecisionAction;
  applicantDisplayName: string;
  rationale: string;
  rejectReasonCode?: string | null;
  rejectFreeText?: string | null;
}

const SUBJECT: Record<ChairDecisionAction, string | null> = {
  APPROVE: "Welcome to YPP — instructor application approved",
  REJECT: "An update on your YPP instructor application",
  HOLD: "Update on your YPP instructor application",
  REQUEST_INFO: "We need a little more information about your application",
  REQUEST_SECOND_INTERVIEW: "Round two — let's chat again",
};

const REASON_INTRO: Record<string, string> = {
  TEACHING_FIT:
    "After reviewing your materials and interview feedback, the chair team felt the curriculum approach wasn't quite the right fit for the program at this time.",
  COMMUNICATION:
    "After our interview process, the chair team had concerns about how some of your responses were communicated to students.",
  PROFESSIONALISM:
    "After our review, the chair team flagged concerns around professional follow-through during the application process.",
  RED_FLAG:
    "Concerns raised in interviews led the chair team to decline this application.",
  OTHER: "After review, the chair team chose not to move forward with this application.",
};

function buildBody(props: EmailPreviewSnippetProps): string {
  const { action, applicantDisplayName, rationale, rejectReasonCode, rejectFreeText } = props;
  switch (action) {
    case "APPROVE":
      return `Hi ${applicantDisplayName},\n\nWe're delighted to welcome you to the Youth Passion Project instructor team. Onboarding details are on the way; the next step is the training module.\n\n${rationale.trim() ? `Notes from your chair: ${rationale.trim()}\n\n` : ""}— The YPP Hiring Team`;
    case "REJECT": {
      const intro = rejectReasonCode ? REASON_INTRO[rejectReasonCode] ?? REASON_INTRO.OTHER : REASON_INTRO.OTHER;
      const free = rejectFreeText?.trim() ?? rationale.trim();
      return `Hi ${applicantDisplayName},\n\n${intro}\n\n${free}\n\nWe appreciate the time you put into this process and wish you the best.\n\n— The YPP Hiring Team`;
    }
    case "HOLD":
      return `Hi ${applicantDisplayName},\n\nYour application is on hold while the chair team gathers more context. ${rationale.trim() ? rationale.trim() + "\n\n" : ""}We'll be in touch soon.\n\n— The YPP Hiring Team`;
    case "REQUEST_INFO":
      return `Hi ${applicantDisplayName},\n\nWe'd like to learn a little more about your application. ${rationale.trim() || "Please reply with the additional details we requested."}\n\n— The YPP Hiring Team`;
    case "REQUEST_SECOND_INTERVIEW":
      return `Hi ${applicantDisplayName},\n\nThanks for the first interview. The chair team would like to schedule a round-two conversation. You'll receive a scheduling link shortly.\n\n— The YPP Hiring Team`;
  }
}

export default function EmailPreviewSnippet(props: EmailPreviewSnippetProps) {
  const subject = SUBJECT[props.action];
  if (!subject) return null;
  const body = buildBody(props);
  const preview = body.slice(0, 220);
  return (
    <div
      className="email-preview-snippet"
      style={{
        marginTop: 12,
        background: "var(--cockpit-surface-strong, #faf8ff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Email preview
      </p>
      <p style={{ margin: "4px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
        {subject}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--ink-muted, #6b5f7a)",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview}
        {body.length > preview.length ? "…" : ""}
      </p>
    </div>
  );
}
