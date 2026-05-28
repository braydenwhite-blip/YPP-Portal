/**
 * Display + behavior config for `ApplicationSource` (PORTAL / GOOGLE_FORMS /
 * CSV_IMPORT / MANUAL_ADMIN_ENTRY) and `ManualEmailKind`.
 *
 * Used by:
 *   - ApplicationSourceBadge      (admin dashboards, applicant detail pages)
 *   - ExternalIntakePanel         (applicant cockpit external-intake section)
 *   - ManualEmailGuidancePanel    (applicant cockpit manual-email tracker)
 *   - lib/external-applicant-intake.ts (default email task seeding)
 *
 * No runtime side effects — pure config + helpers, safe to import from
 * both client and server components.
 */

import { ApplicationSource, ManualEmailKind } from "@prisma/client";

// ─── Source labels ────────────────────────────────────────────────────────────

export interface ApplicationSourceDescriptor {
  /** Short label rendered in dashboard badges + pipeline cards. */
  shortLabel: string;
  /** Longer label for detail headers and tooltips. */
  longLabel: string;
  /** One-sentence description shown in the external-intake panel. */
  description: string;
  /** Badge variant class — matches existing pill styles in globals.css. */
  badgeClass: string;
  /** True for any non-portal source. Used to switch UI affordances. */
  isExternal: boolean;
}

export const APPLICATION_SOURCE_CONFIG: Record<ApplicationSource, ApplicationSourceDescriptor> = {
  PORTAL: {
    shortLabel: "Portal",
    longLabel: "Portal Application",
    description:
      "Applicant submitted through the YPP Portal. All workflow emails go through the portal.",
    badgeClass: "pill pill-info",
    isExternal: false,
  },
  GOOGLE_FORMS: {
    shortLabel: "Google Forms",
    longLabel: "Google Forms",
    description:
      "Application submitted through Google Forms. Managed internally through the YPP review workflow.",
    badgeClass: "pill pill-purple",
    isExternal: true,
  },
  CSV_IMPORT: {
    shortLabel: "CSV Import",
    longLabel: "CSV Import",
    description:
      "Application imported from CSV or Google Sheets. Managed internally through the YPP review workflow.",
    badgeClass: "pill pill-attention",
    isExternal: true,
  },
  MANUAL_ADMIN_ENTRY: {
    shortLabel: "Manual Entry",
    longLabel: "Manual Admin Entry",
    description:
      "Application entered manually by an admin. Managed internally through the YPP review workflow.",
    badgeClass: "pill pill-pending",
    isExternal: true,
  },
};

export function describeApplicationSource(
  source: ApplicationSource,
): ApplicationSourceDescriptor {
  return APPLICATION_SOURCE_CONFIG[source] ?? APPLICATION_SOURCE_CONFIG.PORTAL;
}

export function isExternalApplicationSource(source: ApplicationSource): boolean {
  return describeApplicationSource(source).isExternal;
}

// ─── Manual email kind config ────────────────────────────────────────────────

export interface ManualEmailKindDescriptor {
  /** Short label rendered in the manual-email checklist. */
  label: string;
  /** One-sentence purpose hint. */
  purpose: string;
  /** Stage when this email is typically sent. */
  stage: "intake" | "review" | "interview" | "decision" | "follow_up";
}

export const MANUAL_EMAIL_KIND_CONFIG: Record<ManualEmailKind, ManualEmailKindDescriptor> = {
  APPLICATION_CONFIRMATION: {
    label: "Application confirmation",
    purpose: "Acknowledge receipt of the application and set expectations for next steps.",
    stage: "intake",
  },
  MISSING_INFORMATION_REQUEST: {
    label: "Missing information request",
    purpose: "Ask the applicant to provide missing materials before review can continue.",
    stage: "intake",
  },
  REVIEW_UPDATE: {
    label: "Review update",
    purpose: "Update the applicant on review progress when the wait is longer than usual.",
    stage: "review",
  },
  INTERVIEW_INVITATION: {
    label: "Interview invitation",
    purpose: "Invite the applicant to schedule an interview, including proposed times.",
    stage: "interview",
  },
  INTERVIEW_CONFIRMATION: {
    label: "Interview confirmation",
    purpose: "Confirm the chosen interview time and share the meeting details.",
    stage: "interview",
  },
  INTERVIEW_REMINDER: {
    label: "Interview reminder",
    purpose: "Remind the applicant about an upcoming interview, day before or day of.",
    stage: "interview",
  },
  POST_INTERVIEW_FOLLOWUP: {
    label: "Post-interview follow-up",
    purpose: "Thank the applicant for interviewing and outline the remaining decision timeline.",
    stage: "interview",
  },
  ACCEPTANCE: {
    label: "Acceptance",
    purpose: "Communicate the acceptance decision and trigger onboarding.",
    stage: "decision",
  },
  WAITLIST: {
    label: "Waitlist",
    purpose: "Let the applicant know they are waitlisted and explain what happens next.",
    stage: "decision",
  },
  REJECTION: {
    label: "Rejection",
    purpose: "Deliver a respectful rejection and, where appropriate, invite a future re-application.",
    stage: "decision",
  },
  WITHDRAWAL_CONFIRMATION: {
    label: "Withdrawal confirmation",
    purpose: "Confirm receipt of the applicant's withdrawal so the file is closed cleanly.",
    stage: "follow_up",
  },
  GENERAL_FOLLOWUP: {
    label: "General follow-up",
    purpose: "Catch-all for any other manual touchpoint that isn't covered above.",
    stage: "follow_up",
  },
};

export function describeManualEmailKind(kind: ManualEmailKind): ManualEmailKindDescriptor {
  return MANUAL_EMAIL_KIND_CONFIG[kind] ?? MANUAL_EMAIL_KIND_CONFIG.GENERAL_FOLLOWUP;
}

// ─── Suggested email templates ────────────────────────────────────────────────

export interface ManualEmailTemplate {
  subject: string;
  body: string;
}

export interface ManualEmailTemplateInput {
  applicantName: string | null;
  applicationLabel: string; // e.g. "Instructor", "Summer Workshop Instructor", "Chapter President"
  chapterName?: string | null;
  interviewDate?: string | null;
  interviewLink?: string | null;
  missingItems?: string[];
}

/**
 * Renders a suggested manual-email subject + body. The admin is expected to
 * copy/paste the result into their email client and personalize it.
 *
 * Returned text is intentionally template-y — no portal links, no
 * auto-populated decision phrasing. The admin keeps final editorial control.
 */
export function buildManualEmailTemplate(
  kind: ManualEmailKind,
  input: ManualEmailTemplateInput,
): ManualEmailTemplate {
  const greetingName = (input.applicantName ?? "there").trim() || "there";
  const role = input.applicationLabel || "YPP";
  const chapter = input.chapterName ? ` (${input.chapterName})` : "";

  switch (kind) {
    case "APPLICATION_CONFIRMATION":
      return {
        subject: `Your ${role} application — received`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Thanks for applying to YPP as a ${role}${chapter}. We've received your application and our team will begin reviewing it shortly.`,
          "",
          "We'll be in touch with next steps. If anything changes on your side in the meantime, just reply to this email.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "MISSING_INFORMATION_REQUEST": {
      const itemsBlock = (input.missingItems ?? []).filter(Boolean).map((i) => `  • ${i}`).join("\n");
      return {
        subject: `${role} application — one more thing we need`,
        body: [
          `Hi ${greetingName},`,
          "",
          `We're reviewing your ${role} application and need a bit more information before we can continue:`,
          "",
          itemsBlock || "  • [List the missing items here]",
          "",
          "Just reply to this email with the missing details and we'll pick the review back up.",
          "",
          "Thanks,",
          "The YPP team",
        ].join("\n"),
      };
    }

    case "REVIEW_UPDATE":
      return {
        subject: `${role} application — quick update`,
        body: [
          `Hi ${greetingName},`,
          "",
          `A quick note to let you know we're still actively reviewing your ${role} application. Thanks for your patience while we get to it carefully.`,
          "",
          "We'll follow up as soon as we have an update.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "INTERVIEW_INVITATION":
      return {
        subject: `${role} application — interview invitation`,
        body: [
          `Hi ${greetingName},`,
          "",
          `We'd like to invite you to an interview as part of your ${role} application.`,
          "",
          "Please reply with your availability across the following options:",
          "",
          "  • [Time option 1]",
          "  • [Time option 2]",
          "  • [Time option 3]",
          "",
          "Looking forward to talking,",
          "The YPP team",
        ].join("\n"),
      };

    case "INTERVIEW_CONFIRMATION":
      return {
        subject: `${role} interview — confirmed`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Confirming your ${role} interview:`,
          "",
          `  • When: ${input.interviewDate ?? "[Date and time]"}`,
          `  • Where: ${input.interviewLink ?? "[Meeting details]"}`,
          "",
          "Reply to this email if anything changes. See you then!",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "INTERVIEW_REMINDER":
      return {
        subject: `Reminder: ${role} interview`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Just a friendly reminder of your ${role} interview ${
            input.interviewDate ? `on ${input.interviewDate}` : "soon"
          }${input.interviewLink ? ` — meeting details: ${input.interviewLink}` : ""}.`,
          "",
          "If anything has changed, please reply and let us know.",
          "",
          "Talk soon,",
          "The YPP team",
        ].join("\n"),
      };

    case "POST_INTERVIEW_FOLLOWUP":
      return {
        subject: `Thanks for interviewing — ${role}`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Thanks for taking the time to interview for the ${role} role. We'll be discussing internally and will follow up with next steps within the next few days.`,
          "",
          "Reach out if any questions come up in the meantime.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "ACCEPTANCE":
      return {
        subject: `Welcome to YPP — ${role}`,
        body: [
          `Hi ${greetingName},`,
          "",
          `We're delighted to invite you to join YPP as a ${role}${chapter}!`,
          "",
          "We'll share onboarding steps and your next actions shortly. If you have any immediate questions, just reply here.",
          "",
          "Welcome aboard,",
          "The YPP team",
        ].join("\n"),
      };

    case "WAITLIST":
      return {
        subject: `${role} application — waitlist update`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Thanks again for applying to YPP as a ${role}. After careful consideration, we'd like to place you on our waitlist. If a spot opens up, you'll be among the first we reach out to.`,
          "",
          "Thank you for your interest in YPP.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "REJECTION":
      return {
        subject: `${role} application — update`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Thank you for applying to YPP as a ${role} and for the time you put into your application. After careful review we won't be moving forward at this time.`,
          "",
          "We genuinely appreciate your interest in YPP and wish you the best in what's next. You're welcome to apply again in a future cycle.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "WITHDRAWAL_CONFIRMATION":
      return {
        subject: `${role} application — withdrawal confirmed`,
        body: [
          `Hi ${greetingName},`,
          "",
          `Confirming we've closed out your ${role} application at your request. Thanks for letting us know.`,
          "",
          "You're always welcome to apply again in the future.",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };

    case "GENERAL_FOLLOWUP":
    default:
      return {
        subject: `${role} application — follow-up`,
        body: [
          `Hi ${greetingName},`,
          "",
          "Following up on your application — [add personalized message here].",
          "",
          "Warmly,",
          "The YPP team",
        ].join("\n"),
      };
  }
}

// ─── Default email-task seeds for newly-imported external applicants ────────

/**
 * Default checklist of manual emails seeded when an external applicant is
 * imported. Admins can add/remove/skip these in the manual-email panel.
 *
 * Portal-native applicants do NOT get seeded — the portal already auto-sends
 * the equivalent emails (sendNewApplicationNotification, etc.).
 */
export const DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS: ManualEmailKind[] = [
  "APPLICATION_CONFIRMATION",
];

/**
 * Returns the set of email kinds that should remain visible at each major
 * stage of the application. Used by the manual-email panel to surface
 * "next email to send" suggestions even when the admin has not yet seeded
 * the task explicitly.
 */
export function suggestedEmailKindsForStatus(status: string | null | undefined): ManualEmailKind[] {
  switch (status) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return ["APPLICATION_CONFIRMATION", "MISSING_INFORMATION_REQUEST", "REVIEW_UPDATE"];
    case "INFO_REQUESTED":
      return ["MISSING_INFORMATION_REQUEST"];
    case "PRE_APPROVED":
    case "INTERVIEW_SCHEDULED":
      return ["INTERVIEW_INVITATION", "INTERVIEW_CONFIRMATION", "INTERVIEW_REMINDER"];
    case "INTERVIEW_COMPLETED":
    case "CHAIR_REVIEW":
      return ["POST_INTERVIEW_FOLLOWUP"];
    case "APPROVED":
    case "ACCEPTED":
      return ["ACCEPTANCE"];
    case "WAITLISTED":
      return ["WAITLIST"];
    case "REJECTED":
      return ["REJECTION"];
    case "WITHDRAWN":
      return ["WITHDRAWAL_CONFIRMATION"];
    case "ON_HOLD":
      return ["REVIEW_UPDATE", "GENERAL_FOLLOWUP"];
    default:
      return ["GENERAL_FOLLOWUP"];
  }
}
