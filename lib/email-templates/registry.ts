/**
 * Email template registry — the code-defined source of truth for every
 * customizable portal email.
 *
 * Each entry holds the DEFAULT subject and inner-body HTML (the part that goes
 * inside `emailShell`) with `{{variable}}` placeholders, plus the list of
 * variables that template supports. A stored `EmailTemplateOverride` row (keyed
 * by `key`) supersedes these defaults; deleting that row reverts to the default
 * here. See `lib/email-templates/render.ts`.
 *
 * Rollout note: this currently covers the instructor hiring-chair decision
 * family (the priority). Other `sendXxxEmail` functions in `lib/email.ts` are
 * converted to render through this registry incrementally — adding one is a
 * matter of lifting its inline HTML here and swapping the function body for a
 * `sendTemplatedEmail(key, ...)` call.
 */

export interface EmailTemplateVar {
  /** Placeholder name used as `{{key}}` in subject/body. */
  key: string;
  /** Human label shown in the admin editor. */
  label: string;
  /** Example value used for live preview. */
  sample: string;
  /** Whether the template is expected to always receive this value. */
  required?: boolean;
}

export interface EmailTemplateDef {
  /** Stable identifier, e.g. "chair_decision.hold". */
  key: string;
  /** Human name shown in the admin editor. */
  name: string;
  /** Grouping for the admin list. */
  category: string;
  /** Short description of when this email is sent. */
  description: string;
  /** Default subject line (supports `{{vars}}`). */
  defaultSubject: string;
  /** Default inner body HTML (goes inside emailShell; supports `{{vars}}`). */
  defaultBody: string;
  /** Variables this template supports. */
  variables: EmailTemplateVar[];
  /** Whether send sites should offer one-off inline editing for this email. */
  inlineEditable?: boolean;
}

const STATUS_BUTTON = (label: string) => `
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">${label}</a>
    </div>`;

const VAR_APPLICANT_NAME: EmailTemplateVar = {
  key: "applicantName",
  label: "Applicant name",
  sample: "Jordan Lee",
  required: true,
};

const VAR_STATUS_URL: EmailTemplateVar = {
  key: "statusUrl",
  label: "Application status page URL",
  sample: "https://portal.youthpassionproject.org/application-status",
  required: true,
};

export const EMAIL_TEMPLATES: Record<string, EmailTemplateDef> = {
  "application.approved": {
    key: "application.approved",
    name: "Chair decision — Approve",
    category: "Instructor hiring — chair decisions",
    description:
      "Sent to the applicant when the hiring chair approves an instructor application.",
    defaultSubject: "Your YPP Instructor Application Has Been Approved!",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Congratulations, {{applicantName}}!</h2>
    <p>We are thrilled to let you know that your application to become an instructor at Youth Passion Project has been <strong>approved</strong>.</p>
    <p>You can now log in to the portal and begin your instructor training. Once you complete training and your interview, you will be fully certified to teach.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{trainingUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Instructor Training</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Welcome to the team! We look forward to working with you.</p>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "trainingUrl",
        label: "Instructor training URL",
        sample: "https://portal.youthpassionproject.org/instructor-training",
        required: true,
      },
    ],
    inlineEditable: true,
  },

  "application.rejected": {
    key: "application.rejected",
    name: "Chair decision — Reject",
    category: "Instructor hiring — chair decisions",
    description:
      "Sent to the applicant when the hiring chair declines an instructor application.",
    defaultSubject: "Update on Your YPP Instructor Application",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Thank You for Applying, {{applicantName}}</h2>
    <p>Thank you for your interest in becoming an instructor at Youth Passion Project. After careful consideration, we are unfortunately not moving forward with your application at this time.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #44403c;"><strong>Reviewer notes:</strong> {{reason}}</p>
    </div>
    <p>We encourage you to reapply in the future as your situation or our needs change. Thank you again for your interest in our mission.</p>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "reason",
        label: "Reviewer notes / reason",
        sample: "The chair review did not result in approval.",
      },
    ],
    inlineEditable: true,
  },

  "application.info_request": {
    key: "application.info_request",
    name: "Chair decision — Request more information",
    category: "Instructor hiring — chair decisions",
    description:
      "Sent to the applicant when the hiring chair requests additional information.",
    defaultSubject: "YPP Needs More Information About Your Application",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Additional Information Needed</h2>
    <p>Hi {{applicantName}}, a reviewer has reviewed your instructor application and has a follow-up question or request before proceeding.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #44403c;"><strong>Message from reviewer:</strong></p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #1c1917;">{{message}}</p>
    </div>
    <p>Please log in to your application status page to submit your response.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Respond to Request</a>
    </div>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "message",
        label: "Message to applicant",
        sample: "Please share an updated availability for your interview.",
      },
      VAR_STATUS_URL,
    ],
    inlineEditable: true,
  },

  "chair_decision.hold": {
    key: "chair_decision.hold",
    name: "Chair decision — Hold",
    category: "Instructor hiring — chair decisions",
    description: "Sent to the applicant when the hiring chair places an application on hold.",
    defaultSubject: "Your YPP Instructor Application is on Hold",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Your YPP Instructor Application is on Hold</h2>
    <p>Hi {{applicantName}},</p>
    <p>Your application has been placed on hold while the committee gathers additional information. We will follow up when a decision is ready.</p>${STATUS_BUTTON(
      "View Application Status"
    )}`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
    inlineEditable: true,
  },

  "chair_decision.waitlist": {
    key: "chair_decision.waitlist",
    name: "Chair decision — Waitlist",
    category: "Instructor hiring — chair decisions",
    description: "Sent to the applicant when the hiring chair waitlists an application.",
    defaultSubject: "Your YPP Instructor Application — Waitlisted",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Your YPP Instructor Application — Waitlisted</h2>
    <p>Hi {{applicantName}},</p>
    <p>Thank you for your interest in teaching at Youth Passion Project. The committee has placed your application on the waitlist while we evaluate openings. We will reach out if a slot becomes available.</p>${STATUS_BUTTON(
      "View Application Status"
    )}`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
    inlineEditable: true,
  },

  "chair_decision.approve_with_conditions": {
    key: "chair_decision.approve_with_conditions",
    name: "Chair decision — Approve with conditions",
    category: "Instructor hiring — chair decisions",
    description:
      "Sent to the applicant when the hiring chair approves an application with conditions.",
    defaultSubject: "Your YPP Instructor Application is Approved — With Conditions",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Welcome to YPP — Approved With Conditions</h2>
    <p>Hi {{applicantName}},</p>
    <p>Your instructor application has been <strong>approved with a few specific conditions</strong> set by the committee. Details on each condition will follow in a separate onboarding note.</p>${STATUS_BUTTON(
      "View Application Status"
    )}`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
    inlineEditable: true,
  },

  "chair_decision.general_update": {
    key: "chair_decision.general_update",
    name: "Chair decision — General update (fallback)",
    category: "Instructor hiring — chair decisions",
    description:
      "Generic update used when a chair decision action has no dedicated template.",
    defaultSubject: "Update on Your YPP Instructor Application",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Update on Your YPP Instructor Application</h2>
    <p>Hi {{applicantName}},</p>
    <p>There has been an update to your instructor application. Please log in to view the latest status.</p>${STATUS_BUTTON(
      "View Application Status"
    )}`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
    inlineEditable: true,
  },

  "chair_decision.request_second_interview": {
    key: "chair_decision.request_second_interview",
    name: "Chair decision — Request second interview",
    category: "Instructor hiring — chair decisions",
    description:
      "Sent to the applicant when the hiring chair requests a second interview.",
    defaultSubject: "Your YPP Application — Second Interview Requested",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Second Interview Requested</h2>
    <p>Hi {{applicantName}},</p>
    <p>The committee would like to schedule a second interview before making a final decision. Your reviewer will be in touch with available times shortly.</p>${STATUS_BUTTON(
      "View Application Status"
    )}`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
    inlineEditable: true,
  },
};

/** All registry entries as an array. */
export function listEmailTemplates(): EmailTemplateDef[] {
  return Object.values(EMAIL_TEMPLATES);
}

/** Look up a template definition by key. */
export function getEmailTemplateDef(key: string): EmailTemplateDef | undefined {
  return EMAIL_TEMPLATES[key];
}

/** Whether a key corresponds to a known registry template. */
export function isKnownTemplateKey(key: string): key is string {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, key);
}

/** Build a preview variable map from each variable's `sample` value. */
export function sampleVarsFor(def: EmailTemplateDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of def.variables) out[v.key] = v.sample;
  return out;
}

/**
 * Map a chair decision action to its email-template registry key. Shared by the
 * send path (`sendChairDecisionEmail`) and the inline-edit resolve endpoint so
 * both agree on which template a decision uses.
 */
export function chairDecisionTemplateKey(action: string): string {
  switch (action) {
    case "APPROVE":
      return "application.approved";
    case "REJECT":
      return "application.rejected";
    case "REQUEST_INFO":
      return "application.info_request";
    case "HOLD":
      return "chair_decision.hold";
    case "WAITLIST":
      return "chair_decision.waitlist";
    case "APPROVE_WITH_CONDITIONS":
      return "chair_decision.approve_with_conditions";
    case "REQUEST_SECOND_INTERVIEW":
      return "chair_decision.request_second_interview";
    default:
      return "chair_decision.general_update";
  }
}
