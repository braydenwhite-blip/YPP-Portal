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
  /**
   * The value is a pre-rendered, application-generated HTML fragment (e.g. a
   * digest list) and is inserted WITHOUT escaping. Never use for user input.
   */
  raw?: boolean;
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

  // ─── Account & sign-in ──────────────────────────────────────────────────────
  "account.password_reset": {
    key: "account.password_reset",
    name: "Password reset",
    category: "Account & sign-in",
    description: "Sent when a user requests a password reset.",
    defaultSubject: "Reset Your Password - Youth Passion Project",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Reset Your Password</h2>
    <p>Hi {{name}},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{resetUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Reset Password</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">{{resetUrl}}</p>`,
    variables: [
      { key: "name", label: "Recipient name", sample: "Jordan Lee", required: true },
      {
        key: "resetUrl",
        label: "Password reset URL",
        sample: "https://portal.youthpassionproject.org/reset-password?token=abc123",
        required: true,
      },
    ],
  },

  "account.setup": {
    key: "account.setup",
    name: "Account setup",
    category: "Account & sign-in",
    description: "Sent when an account has been prepared for a user to finish setting up.",
    defaultSubject: "Set Up Your {{roleLabel}} Account - Youth Passion Project",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Finish Setting Up Your Account</h2>
    <p>Hi {{name}},</p>
    <p>A Youth Passion Project {{roleLabelLower}} account has been prepared for you.</p>
    <p>Click the button below to choose your password and finish signing in for the first time.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{setupUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Set Up Account</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link is single-use. If you did not expect this account, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">{{setupUrl}}</p>`,
    variables: [
      { key: "name", label: "Recipient name", sample: "Jordan Lee", required: true },
      { key: "roleLabel", label: "Role label", sample: "Instructor", required: true },
      {
        key: "roleLabelLower",
        label: "Role label (lowercase)",
        sample: "instructor",
        required: true,
      },
      {
        key: "setupUrl",
        label: "Account setup URL",
        sample: "https://portal.youthpassionproject.org/setup?token=abc123",
        required: true,
      },
    ],
  },

  "account.email_verification": {
    key: "account.email_verification",
    name: "Email verification",
    category: "Account & sign-in",
    description: "Sent to verify a newly registered email address.",
    defaultSubject: "Verify Your Email - Youth Passion Project",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Verify Your Email Address</h2>
    <p>Hi {{name}},</p>
    <p>Thanks for signing up! Click the button below to verify your email and activate your account:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verifyUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Verify Email Address</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">{{verifyUrl}}</p>`,
    variables: [
      { key: "name", label: "Recipient name", sample: "Jordan Lee", required: true },
      {
        key: "verifyUrl",
        label: "Email verification URL",
        sample: "https://portal.youthpassionproject.org/verify?token=abc123",
        required: true,
      },
    ],
  },

  "account.magic_link": {
    key: "account.magic_link",
    name: "Magic sign-in link",
    category: "Account & sign-in",
    description: "Sent when a user requests a passwordless magic sign-in link.",
    defaultSubject: "Your Magic Sign-In Link - Youth Passion Project",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Sign In to Your Account</h2>
    <p>Hi {{name}},</p>
    <p>Click the button below to sign in instantly — no password needed. This link is single-use and expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{magicUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Sign In Now</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">{{magicUrl}}</p>`,
    variables: [
      { key: "name", label: "Recipient name", sample: "Jordan Lee", required: true },
      {
        key: "magicUrl",
        label: "Magic sign-in URL",
        sample: "https://portal.youthpassionproject.org/magic?token=abc123",
        required: true,
      },
    ],
  },

  // ─── Notifications ──────────────────────────────────────────────────────────
  "notification.generic": {
    key: "notification.generic",
    name: "Generic notification",
    category: "Notifications",
    description:
      "General-purpose portal notification (also used for new-message, mentorship-reminder, and application-status emails).",
    defaultSubject: "{{title}} - Youth Passion Project",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">{{title}}</h2>
    <p>Hi {{name}},</p>
    <p>{{body}}</p>
    {{linkHtml}}
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">This email was sent from the YPP Pathways Portal. Notification delivery follows a fixed portal-wide policy.</p>`,
    variables: [
      { key: "title", label: "Notification title", sample: "New Message", required: true },
      { key: "name", label: "Recipient name", sample: "Jordan Lee", required: true },
      {
        key: "body",
        label: "Notification body text",
        sample: "You have a new update waiting in the portal.",
        required: true,
      },
      {
        key: "linkHtml",
        label: "Call-to-action button (HTML)",
        sample:
          '<div style="text-align: center; margin: 24px 0;"><a href="https://portal.youthpassionproject.org" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">View Details</a></div>',
        raw: true,
      },
    ],
  },

  "notification.announcement": {
    key: "notification.announcement",
    name: "Announcement",
    category: "Notifications",
    description: "Sent to members when a new announcement is posted.",
    defaultSubject: "Announcement: {{announcementTitle}} - Youth Passion Project",
    defaultBody: `
    <p style="color: #78716c; font-size: 13px; margin: 0 0 4px;">New Announcement</p>
    <p style="color: #78716c; font-size: 13px; margin: 0 0 8px;">Hi {{recipientName}},</p>
    <h2 style="margin: 0 0 16px; color: #1c1917;">{{announcementTitle}}</h2>
    <p style="white-space: pre-wrap;">{{announcementContent}}</p>
    <p style="color: #78716c; font-size: 13px; margin-top: 24px;">— {{authorName}}</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{portalUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">View in Portal</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">You received this because you're a member of Youth Passion Project. Notification delivery follows a fixed portal-wide policy.</p>`,
    variables: [
      { key: "recipientName", label: "Recipient name", sample: "Jordan Lee", required: true },
      {
        key: "announcementTitle",
        label: "Announcement title",
        sample: "Spring Showcase Volunteers Needed",
        required: true,
      },
      {
        key: "announcementContent",
        label: "Announcement content",
        sample: "We're looking for volunteers to help run our spring showcase event.",
        required: true,
      },
      { key: "authorName", label: "Author name", sample: "Alex Rivera", required: true },
      {
        key: "portalUrl",
        label: "Portal URL",
        sample: "https://portal.youthpassionproject.org/announcements",
        required: true,
      },
    ],
  },

  // ─── People Strategy — actions ──────────────────────────────────────────────
  "action.new_assignment": {
    key: "action.new_assignment",
    name: "New action assignment",
    category: "People Strategy — actions",
    description: "Sent when a user is newly added to an action assignment.",
    defaultSubject: "You've Been Assigned a New Action",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">You've been assigned a new action</h2>
    <p>Hi {{firstName}},</p>
    <p>You've been added to an action item as <strong>{{roleLabel}}</strong>.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Lead</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{leadName}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #1c1917; font-size: 15px;">{{deadline}}</p>
    </div>
    <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="margin: 0; font-size: 14px; color: #5b21b6; font-weight: 600;">Your role — {{roleLabel}}</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #44403c;">{{roleExplanation}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{actionUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Full Action Item</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You're receiving this because you were assigned to this action in the YPP Pathways Portal.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "roleLabel", label: "Assignment role label", sample: "Lead", required: true },
      {
        key: "roleExplanation",
        label: "Role explanation",
        sample: "You are accountable for the outcome and support the executors.",
        required: true,
      },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "leadName", label: "Lead name", sample: "Alex Rivera", required: true },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "actionUrl",
        label: "Action item URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
    ],
  },

  "action.weekly_people_digest": {
    key: "action.weekly_people_digest",
    name: "Weekly officer digest",
    category: "People Strategy — actions",
    description:
      "Weekly Monday email to every officer: this week's top priorities, who to congratulate, and who has overdue work.",
    defaultSubject: "Weekly priorities & people to reach out to — {{weekLabel}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">This week's priorities & people</h2>
    <p>Hi {{firstName}},</p>
    <p>Here's this week's read — the top priorities, who to congratulate, and who could use a follow-up nudge. The same signals live on the Command Center, where every item links through.</p>
    <p style="margin: 24px 0 10px; color: #dc2626; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">This week's priorities</p>
    {{prioritiesHtml}}
    <p style="margin: 24px 0 10px; color: #16a34a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Reach out &amp; congratulate</p>
    {{congratsHtml}}
    <p style="margin: 24px 0 10px; color: #d97706; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Follow up on overdue work</p>
    {{overdueHtml}}
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{commandCenterUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Open the Command Center</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You're receiving this because you're part of YPP's officer team. Sent every Monday.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "weekLabel", label: "Week label", sample: "Jun 1", required: true },
      {
        key: "prioritiesHtml",
        label: "This week's priorities (HTML)",
        sample:
          '<div style="border-left: 4px solid #dc2626; background: #fafaf9; border-radius: 6px; padding: 12px 16px; margin: 0 0 10px;"><a href="https://portal.youthpassionproject.org/actions/1" style="color: #1c1917; font-size: 15px; font-weight: 600; text-decoration: none;">Draft Q3 outreach plan</a></div>',
        raw: true,
      },
      {
        key: "congratsHtml",
        label: "Reach out & congratulate (HTML)",
        sample:
          '<div style="border-left: 4px solid #16a34a; background: #fafaf9; border-radius: 6px; padding: 12px 16px; margin: 0 0 10px;"><p style="margin: 0; color: #1c1917; font-size: 15px; font-weight: 600;">Alex Rivera</p></div>',
        raw: true,
      },
      {
        key: "overdueHtml",
        label: "Follow up on overdue work (HTML)",
        sample:
          '<div style="border-left: 4px solid #d97706; background: #fafaf9; border-radius: 6px; padding: 12px 16px; margin: 0 0 10px;"><p style="margin: 0; color: #1c1917; font-size: 15px; font-weight: 600;">Jordan Lee</p></div>',
        raw: true,
      },
      {
        key: "commandCenterUrl",
        label: "Command Center URL",
        sample: "https://portal.youthpassionproject.org/work",
        required: true,
      },
    ],
  },

  "action.deadline_warning": {
    key: "action.deadline_warning",
    name: "Action due tomorrow",
    category: "People Strategy — actions",
    description: "Sent to an assignee 24 hours before an action's deadline.",
    defaultSubject: "Due tomorrow: {{actionTitle}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">This action is due tomorrow</h2>
    <p>Hi {{firstName}},</p>
    <p>An action you're assigned to is due <strong>tomorrow</strong>. Please update its status or flag a blocker before the deadline.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Your role</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{role}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{department}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #b91c1c; font-size: 15px; font-weight: 600;">{{deadline}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{updateStatusUrl}}" style="background: #6b21c8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Update Status</a>
      <a href="{{flagToLeadershipUrl}}" style="background: #ffffff; color: #6b21c8; border: 1px solid #6b21c8; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Flag to Leadership</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">The action's Lead has also been notified.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "role", label: "Your role", sample: "Executing", required: true },
      { key: "department", label: "Department", sample: "Outreach", required: true },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "updateStatusUrl",
        label: "Update status URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
      {
        key: "flagToLeadershipUrl",
        label: "Flag to leadership URL",
        sample: "https://portal.youthpassionproject.org/actions/123?flag=1",
        required: true,
      },
    ],
  },

  "action.deadline_reached": {
    key: "action.deadline_reached",
    name: "Action due today",
    category: "People Strategy — actions",
    description: "Sent to an assignee on the day an action's deadline is reached.",
    defaultSubject: "Due today: {{actionTitle}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">This action reaches its deadline today</h2>
    <p>Hi {{firstName}},</p>
    <p>An action you're assigned to is due <strong>today</strong>. If it's done, mark it complete — otherwise update its status or flag a blocker. Items with no status update by end of day are marked <strong>Overdue</strong> and the Lead is notified.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Your role</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{role}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{department}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #b91c1c; font-size: 15px; font-weight: 600;">{{deadline}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{updateStatusUrl}}" style="background: #6b21c8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Update Status</a>
      <a href="{{flagToLeadershipUrl}}" style="background: #ffffff; color: #6b21c8; border: 1px solid #6b21c8; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Flag to Leadership</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You're receiving this because you're assigned to this action in the YPP Pathways Portal.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "role", label: "Your role", sample: "Executing", required: true },
      { key: "department", label: "Department", sample: "Outreach", required: true },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "updateStatusUrl",
        label: "Update status URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
      {
        key: "flagToLeadershipUrl",
        label: "Flag to leadership URL",
        sample: "https://portal.youthpassionproject.org/actions/123?flag=1",
        required: true,
      },
    ],
  },

  "action.overdue_lead": {
    key: "action.overdue_lead",
    name: "Action overdue (Lead)",
    category: "People Strategy — actions",
    description: "Sent to the Lead when an action passes its deadline with no status update.",
    defaultSubject: "Action overdue: {{actionTitle}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">An action you lead is now overdue</h2>
    <p>Hi {{firstName}},</p>
    <p>An action you're the <strong>Lead</strong> on passed its deadline with no status update and has been marked <strong>Overdue</strong>.</p>
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{department}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #b91c1c; font-size: 15px; font-weight: 600;">{{deadline}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{actionUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Review Action</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">As Lead you're accountable for the outcome — follow up with the executors or escalate to Leadership if it's blocked.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "department", label: "Department", sample: "Outreach", required: true },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "actionUrl",
        label: "Action item URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
    ],
  },

  "action.leadership_escalation": {
    key: "action.leadership_escalation",
    name: "Leadership escalation",
    category: "People Strategy — actions",
    description: "Sent to Leadership when a flagged/overdue action is auto-escalated.",
    defaultSubject: "Escalation: {{actionTitle}} ({{reason}})",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">An action needs your attention</h2>
    <p>Hi {{firstName}},</p>
    <p>The action below has been <strong>{{reasonLower}}</strong> for <strong>{{ageLabel}}</strong> without resolution, so it has been escalated to you as Leadership.</p>
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Lead</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{leadName}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{department}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Status</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{statusLabel}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #b91c1c; font-size: 15px; font-weight: 600;">{{deadline}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{queueUrl}}" style="background: #6b21c8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Open Escalation Queue</a>
      <a href="{{actionUrl}}" style="background: #ffffff; color: #6b21c8; border: 1px solid #6b21c8; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">View Action</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Review the comment history and either help unblock the Lead or mark the escalation resolved from the People Dashboard.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "reason", label: "Escalation reason", sample: "Overdue", required: true },
      { key: "reasonLower", label: "Escalation reason (lowercase)", sample: "overdue", required: true },
      { key: "ageLabel", label: "Age label", sample: "3 days", required: true },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "leadName", label: "Lead name", sample: "Alex Rivera", required: true },
      { key: "department", label: "Department", sample: "Outreach", required: true },
      { key: "statusLabel", label: "Status label", sample: "Overdue", required: true },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "queueUrl",
        label: "Escalation queue URL",
        sample: "https://portal.youthpassionproject.org/people/escalations",
        required: true,
      },
      {
        key: "actionUrl",
        label: "Action item URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
    ],
  },

  "action.board_rollup": {
    key: "action.board_rollup",
    name: "Board escalation roll-up",
    category: "People Strategy — actions",
    description: "Sent to the Board when a leadership-escalated action stays unresolved.",
    defaultSubject: "Board roll-up: {{actionTitle}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">An escalation has reached the Board</h2>
    <p>Hi {{firstName}},</p>
    <p>The action below was escalated to Leadership <strong>{{leadershipEscalatedLabel}}</strong> and has remained unresolved since, so it has been rolled up to the Board for visibility.</p>
    <div style="background: #fef2f2; border-left: 4px solid #991b1b; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 16px; font-weight: 600;">{{actionTitle}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Lead</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{leadName}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Department</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{department}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Status</p>
      <p style="margin: 0 0 14px; color: #1c1917; font-size: 15px;">{{statusLabel}}</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Unresolved for</p>
      <p style="margin: 0 0 14px; color: #991b1b; font-size: 15px; font-weight: 600;">{{daysUnresolvedLabel}} since Leadership escalation</p>
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Deadline</p>
      <p style="margin: 0; color: #b91c1c; font-size: 15px; font-weight: 600;">{{deadline}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{boardUrl}}" style="background: #6b21c8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">Open Board Roll-up</a>
      <a href="{{actionUrl}}" style="background: #ffffff; color: #6b21c8; border: 1px solid #6b21c8; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin: 0 6px 10px;">View Action</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Review the full comment history on the Board roll-up list and direct Leadership on next steps, or mark it resolved.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      {
        key: "leadershipEscalatedLabel",
        label: "Leadership escalation label",
        sample: "9 days ago",
        required: true,
      },
      { key: "actionTitle", label: "Action title", sample: "Draft Q3 outreach plan", required: true },
      { key: "leadName", label: "Lead name", sample: "Alex Rivera", required: true },
      { key: "department", label: "Department", sample: "Outreach", required: true },
      { key: "statusLabel", label: "Status label", sample: "Overdue", required: true },
      {
        key: "daysUnresolvedLabel",
        label: "Days unresolved label",
        sample: "7 days",
        required: true,
      },
      { key: "deadline", label: "Deadline", sample: "Friday, June 27, 2026", required: true },
      {
        key: "boardUrl",
        label: "Board roll-up URL",
        sample: "https://portal.youthpassionproject.org/board/rollups",
        required: true,
      },
      {
        key: "actionUrl",
        label: "Action item URL",
        sample: "https://portal.youthpassionproject.org/actions/123",
        required: true,
      },
    ],
  },

  // ─── Feedback ───────────────────────────────────────────────────────────────
  "feedback.request": {
    key: "feedback.request",
    name: "360 feedback request",
    category: "Feedback",
    description: "Sent to a recent collaborator asking for confidential 360 feedback.",
    defaultSubject: "Feedback requested: {{subjectName}} ({{monthLabel}})",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Your feedback has been requested</h2>
    <p>Hi {{firstName}},</p>
    <p>As someone who has worked closely with <strong>{{subjectName}}</strong>, you're invited to share confidential feedback for <strong>{{monthLabel}}</strong>.</p>
    <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #5b21b6; font-weight: 600;">This feedback is confidential</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #44403c;">Only Leadership and the Board can read your response. {{subjectName}} will not see what you write, so please be candid and constructive.</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{formUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Share Feedback</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You're receiving this because our records show you recently collaborated with {{subjectName}} in the YPP Pathways Portal.</p>`,
    variables: [
      { key: "firstName", label: "Recipient first name", sample: "Jordan", required: true },
      { key: "subjectName", label: "Feedback subject name", sample: "Alex Rivera", required: true },
      { key: "monthLabel", label: "Month label", sample: "June 2026", required: true },
      {
        key: "formUrl",
        label: "Feedback form URL",
        sample: "https://portal.youthpassionproject.org/feedback/abc123",
        required: true,
      },
    ],
  },

  "feedback.monthly_request": {
    key: "feedback.monthly_request",
    name: "Monthly feedback request",
    category: "Feedback",
    description:
      "Monthly People & Performance feedback request; body is pre-built by the content builder.",
    defaultSubject: "{{subject}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">{{greeting}}</h2>
    {{introHtml}}
    {{workItemsHtml}}
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{formUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Share Feedback</a>
    </div>
    {{closingHtml}}`,
    variables: [
      {
        key: "subject",
        label: "Subject line",
        sample: "Monthly feedback request — June 2026",
        required: true,
      },
      { key: "greeting", label: "Greeting", sample: "Hi Jordan,", required: true },
      {
        key: "introHtml",
        label: "Intro paragraphs (HTML)",
        sample: "<p>We're gathering monthly feedback for the team.</p>",
        raw: true,
      },
      {
        key: "workItemsHtml",
        label: "Work items list (HTML)",
        sample:
          '<ul style="color: #44403c; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 12px 0;"><li>Spring showcase planning</li></ul>',
        raw: true,
      },
      {
        key: "closingHtml",
        label: "Closing paragraphs (HTML)",
        sample: '<p style="color: #57534e; font-size: 14px;">Thank you for your time.</p>',
        raw: true,
      },
      {
        key: "formUrl",
        label: "Feedback form URL",
        sample: "https://portal.youthpassionproject.org/feedback/abc123",
        required: true,
      },
    ],
  },

  // ─── Instructor hiring — applicant ──────────────────────────────────────────
  "applicant.application_submitted": {
    key: "applicant.application_submitted",
    name: "Application received",
    category: "Instructor hiring — applicant",
    description: "Confirmation sent to the applicant immediately after they submit.",
    defaultSubject: "Your YPP Instructor Application Was Received",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Thanks for applying, {{firstName}}!</h2>
    <p>We received your Youth Passion Project instructor application and we're excited to learn more about you.</p>
    <p>Here's what happens next:</p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>Our review team typically reaches out within <strong>3–5 business days</strong>.</li>
      <li>After the interview, we'll make a final decision on your application.</li>
    </ul>
    <p>In the meantime you can check your application status in the portal at any time.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Questions? Reach out to your chapter president or our team.</p>`,
    variables: [
      { key: "firstName", label: "Applicant first name", sample: "Jordan", required: true },
      VAR_STATUS_URL,
    ],
  },

  "applicant.pre_approved": {
    key: "applicant.pre_approved",
    name: "Application pre-approved",
    category: "Instructor hiring — applicant",
    description: "Sent when an application is pre-approved and training is unlocked.",
    defaultSubject: "Great News: Your YPP Application Has Been Pre-Approved",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">You've been pre-approved, {{firstName}}!</h2>
    <p>We're excited to let you know that your instructor application has been reviewed and pre-approved by our team.</p>
    <p><strong>What this means:</strong></p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>You can now begin your <strong>instructor training</strong> in the portal.</li>
      <li>We'll be in touch to schedule your <strong>interview</strong> — a collaborative conversation about your teaching approach and plans.</li>
      <li>After the interview, we'll finalize your application and onboard you as a YPP instructor.</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{trainingUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Instructor Training</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Welcome to the journey — we're looking forward to working with you!</p>`,
    variables: [
      { key: "firstName", label: "Applicant first name", sample: "Jordan", required: true },
      {
        key: "trainingUrl",
        label: "Instructor training URL",
        sample: "https://portal.youthpassionproject.org/instructor-training",
        required: true,
      },
    ],
  },

  "applicant.interview_scheduled": {
    key: "applicant.interview_scheduled",
    name: "Interview scheduled",
    category: "Instructor hiring — applicant",
    description: "Notifies the applicant that an interview has been scheduled.",
    defaultSubject: "Your YPP Interview Has Been Scheduled",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Interview scheduled, {{applicantName}}!</h2>
    <p>Great news — your interview with the review team has been scheduled.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1c1917;">{{formattedDate}}</p>
    </div>
    <p>You can view your full application status and any additional details in the portal.</p>
    {{meetingBlock}}
    <p style="color: #78716c; font-size: 13px;">If you have questions, please reach out to your chapter president or admin.</p>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "formattedDate",
        label: "Formatted interview date/time",
        sample: "Monday, June 30, 2025 at 4:00 PM EDT",
        required: true,
      },
      {
        key: "meetingBlock",
        label: "Meeting details / status button (HTML)",
        sample:
          '<div style="text-align: center; margin: 28px 0;"><a href="https://portal.youthpassionproject.org/application-status" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a></div>',
        raw: true,
      },
    ],
  },

  "applicant.pick_your_time": {
    key: "applicant.pick_your_time",
    name: "Pick your interview time",
    category: "Instructor hiring — applicant",
    description: "Sent when a reviewer proposes interview time slots for the applicant to choose.",
    defaultSubject: "Action Needed: Pick a Time for Your Interview",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Choose your time, {{firstName}}!</h2>
    <p>Great news — your lead interviewer would like to schedule your interview.</p>
    <p><strong>Proposed times:</strong></p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      {{slotRows}}
    </ul>
    <p>Log in to the portal and pick the time that works best for you.</p>
    <p>After you choose a time, your confirmation email and status page will include the meeting details.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Choose Your Time</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">If none of these times work, use the option on your application status page and your lead interviewer will send a new set.</p>`,
    variables: [
      { key: "firstName", label: "Applicant first name", sample: "Jordan", required: true },
      {
        key: "slotRows",
        label: "Proposed time slot rows (HTML)",
        sample:
          '<li style="margin-bottom: 6px;">Monday, June 30, 2025 at 4:00 PM EDT (30 min)</li>',
        raw: true,
      },
      VAR_STATUS_URL,
    ],
  },

  "applicant.interview_times_declined": {
    key: "applicant.interview_times_declined",
    name: "Interview times declined (interviewer)",
    category: "Instructor hiring — applicant",
    description: "Notifies the interviewer that the applicant declined all proposed times.",
    defaultSubject: "Applicant needs new interview times",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">New times needed</h2>
    <p>Hi {{firstName}},</p>
    <p>{{applicantName}} marked that none of the proposed interview times work.</p>
    <p>The previous unconfirmed times were cleared. Please send a new set of exactly 3 future options.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{workspaceUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Send New Times</a>
    </div>`,
    variables: [
      { key: "firstName", label: "Interviewer first name", sample: "Jordan", required: true },
      VAR_APPLICANT_NAME,
      {
        key: "workspaceUrl",
        label: "Interview workspace URL",
        sample: "https://portal.youthpassionproject.org/applications/instructor/123/interview",
        required: true,
      },
    ],
  },

  "applicant.interview_confirmed": {
    key: "applicant.interview_confirmed",
    name: "Interview confirmed",
    category: "Instructor hiring — applicant",
    description: "Confirmation (with ICS invite) sent once the applicant picks a slot.",
    defaultSubject: "Confirmed: Interview Scheduled",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">{{heading}}</h2>
    <p>{{bodyText}}</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1c1917;">{{formattedDate}}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #78716c;">Duration: {{durationMinutes}} minutes</p>
    </div>
    {{meetingBlock}}
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{detailUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Details</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">A calendar invite (.ics) is attached to this email.</p>`,
    variables: [
      {
        key: "heading",
        label: "Heading (HTML)",
        sample: "It's confirmed, Jordan!",
        raw: true,
      },
      {
        key: "bodyText",
        label: "Body text (HTML)",
        sample:
          "Your interview is officially booked. This is a collaborative conversation — come prepared to talk about your teaching approach.",
        raw: true,
      },
      {
        key: "formattedDate",
        label: "Formatted interview date/time",
        sample: "Monday, June 30, 2025 at 4:00 PM EDT",
        required: true,
      },
      { key: "durationMinutes", label: "Duration (minutes)", sample: "30", required: true },
      {
        key: "meetingBlock",
        label: "Meeting details block (HTML)",
        sample: "",
        raw: true,
      },
      {
        key: "detailUrl",
        label: "Interview detail URL",
        sample: "https://portal.youthpassionproject.org/application-status",
        required: true,
      },
    ],
  },

  "applicant.interview_choice_reminder": {
    key: "applicant.interview_choice_reminder",
    name: "Interview choice reminder",
    category: "Instructor hiring — applicant",
    description: "Reminds the applicant to pick one of the proposed interview times.",
    defaultSubject: "Reminder: Pick a Time for Your YPP Interview",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Choose your interview time, {{firstName}}</h2>
    <p>Your lead interviewer sent 3 possible interview times. Please pick the one that works best for you.</p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      {{slotRows}}
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Pick Your Time</a>
    </div>`,
    variables: [
      { key: "firstName", label: "Applicant first name", sample: "Jordan", required: true },
      {
        key: "slotRows",
        label: "Proposed time slot rows (HTML)",
        sample:
          '<li style="margin-bottom: 6px;">Monday, June 30, 2025 at 4:00 PM EDT (30 min)</li>',
        raw: true,
      },
      VAR_STATUS_URL,
    ],
  },

  "applicant.interview_reminder": {
    key: "applicant.interview_reminder",
    name: "Interview reminder",
    category: "Instructor hiring — applicant",
    description: "24-hour / 2-hour reminder of an upcoming interview (applicant or interviewer).",
    defaultSubject: "{{subject}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Interview reminder</h2>
    <p>{{bodyText}}</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1c1917;">{{formattedDate}}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #78716c;">Duration: {{durationMinutes}} minutes</p>
    </div>
    {{meetingBlock}}
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{detailUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Details</a>
    </div>`,
    variables: [
      {
        key: "subject",
        label: "Subject line",
        sample: "Reminder: Your YPP Interview Is Tomorrow",
        required: true,
      },
      {
        key: "bodyText",
        label: "Body text (HTML)",
        sample: "Hi Jordan, this is your 24-hour reminder for your YPP interview.",
        raw: true,
      },
      {
        key: "formattedDate",
        label: "Formatted interview date/time",
        sample: "Monday, June 30, 2025 at 4:00 PM EDT",
        required: true,
      },
      { key: "durationMinutes", label: "Duration (minutes)", sample: "30", required: true },
      {
        key: "meetingBlock",
        label: "Meeting details block (HTML)",
        sample: "",
        raw: true,
      },
      {
        key: "detailUrl",
        label: "Interview detail URL",
        sample: "https://portal.youthpassionproject.org/application-status",
        required: true,
      },
    ],
  },

  "applicant.availability_request": {
    key: "applicant.availability_request",
    name: "Availability request",
    category: "Instructor hiring — applicant",
    description: "Asks the applicant to submit their availability windows for an interview.",
    defaultSubject: "{{subject}}",
    defaultBody: `
    <p style="color: #78716c; font-size: 13px; margin: 0 0 12px; font-style: italic;">{{tagline}}</p>
    <h2 style="margin: 0 0 20px; color: #1c1917; font-size: 22px; font-weight: 800;">{{heading}}</h2>
    <p style="margin: 0 0 20px; color: #44403c; font-size: 15px; line-height: 1.7;">{{bodyText}}</p>
    <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="margin: 0; font-size: 14px; color: #5b21b6; font-weight: 600;">What happens next?</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #44403c;">{{nextStepText}}</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">{{ctaLabel}}</a>
    </div>
    <p style="margin: 0; font-size: 13px; color: #78716c; text-align: center;">Can't click the button? Copy this link into your browser:<br><span style="color: #7c3aed; word-break: break-all;">{{statusUrl}}</span></p>`,
    variables: [
      {
        key: "subject",
        label: "Subject line",
        sample: "Next step: interview time options are coming soon",
        required: true,
      },
      {
        key: "tagline",
        label: "Header tagline",
        sample: "Your teaching journey with YPP is just getting started.",
        required: true,
      },
      {
        key: "heading",
        label: "Heading",
        sample: "Jordan Lee, you've been invited to interview!",
        required: true,
      },
      {
        key: "bodyText",
        label: "Body text",
        sample:
          "This isn't a test — it's a conversation. We want to hear how you think about teaching and get to know you better.",
        required: true,
      },
      {
        key: "nextStepText",
        label: "Next-step text",
        sample:
          "Log in to your application status page. When your lead interviewer sends proposed times, you will be able to pick the one that works best.",
        required: true,
      },
      { key: "ctaLabel", label: "Call-to-action label", sample: "View My Application Status", required: true },
      VAR_STATUS_URL,
    ],
  },

  "applicant.interview_auto_assigned": {
    key: "applicant.interview_auto_assigned",
    name: "Interview auto-assigned",
    category: "Instructor hiring — applicant",
    description: "Sent (with ICS invite) when auto-matching finds an interview slot.",
    defaultSubject: "{{subject}}",
    defaultBody: `
    <p style="color: #78716c; font-size: 13px; margin: 0 0 12px; font-style: italic;">{{tagline}}</p>
    <h2 style="margin: 0 0 20px; color: #1c1917; font-size: 22px; font-weight: 800;">{{heading}}</h2>
    <p style="margin: 0 0 20px; color: #44403c; font-size: 15px; line-height: 1.7;">{{bodyText}}</p>
    <div style="background: #f5f3ff; border-radius: 10px; padding: 20px; margin: 0 0 20px; text-align: center; border: 1px solid #ede9fe;">
      <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #7c3aed;">Your {{sessionLabelCap}}</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #4c1d95;">{{formattedDate}}</p>
    </div>
    {{meetingLinkHtml}}
    <p style="margin: 0; font-size: 13px; color: #78716c; text-align: center;">The calendar invite (.ics file) is attached — open it to add this event to your calendar.</p>`,
    variables: [
      {
        key: "subject",
        label: "Subject line",
        sample: "Your YPP interview is confirmed — add it to your calendar",
        required: true,
      },
      {
        key: "tagline",
        label: "Header tagline",
        sample: "The conversation that could change everything.",
        required: true,
      },
      {
        key: "heading",
        label: "Heading",
        sample: "It's official, Jordan! Your interview is booked.",
        required: true,
      },
      {
        key: "bodyText",
        label: "Body text",
        sample:
          "Come ready to talk about your leadership philosophy, your vision for your chapter, and why you believe in YPP's mission.",
        required: true,
      },
      {
        key: "sessionLabelCap",
        label: "Session label (capitalized)",
        sample: "Interview",
        required: true,
      },
      {
        key: "formattedDate",
        label: "Formatted session date/time",
        sample: "Monday, June 30, 2025 at 4:00 PM EDT",
        required: true,
      },
      {
        key: "meetingLinkHtml",
        label: "Meeting join link (HTML)",
        sample:
          '<div style="text-align: center; margin: 20px 0 8px;"><a href="https://meet.example.com/abc" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px;">Join Your Interview</a></div>',
        raw: true,
      },
    ],
  },

  "applicant.no_match_found": {
    key: "applicant.no_match_found",
    name: "No matching slot found (admin)",
    category: "Instructor hiring — applicant",
    description: "Sent to admins when auto-matching cannot find an overlapping interview slot.",
    defaultSubject: "[Action needed] No matching slot found for {{applicantName}}",
    defaultBody: `
    <p style="color: #78716c; font-size: 13px; margin: 0 0 12px; font-style: italic;">Scheduling needs your attention.</p>
    <h2 style="margin: 0 0 16px; color: #1c1917; font-size: 20px; font-weight: 800;">Scheduling couldn't auto-complete for {{applicantName}}</h2>
    <p style="margin: 0 0 16px; color: #44403c; font-size: 15px; line-height: 1.7;">
      {{applicantName}} submitted their availability windows for a {{sessionLabel}}, but no overlap was found with the assigned reviewer's schedule.
    </p>
    <div style="background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">What to do</p>
      <ul style="margin: 8px 0 0; padding: 0 0 0 18px; font-size: 14px; color: #78350f; line-height: 1.8;">
        <li>The applicant has been prompted to add more availability windows and will retry automatically.</li>
        <li>You can also manually schedule the {{sessionLabel}} from the admin panel.</li>
        <li>Or ask the assigned reviewer to expand their availability rules.</li>
      </ul>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{adminUrl}}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px;">View Application</a>
    </div>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "sessionLabel",
        label: "Session label",
        sample: "curriculum review session",
        required: true,
      },
      {
        key: "adminUrl",
        label: "Admin application URL",
        sample: "https://portal.youthpassionproject.org/admin/instructor-applicants/123",
        required: true,
      },
    ],
  },

  "applicant.materials_missing": {
    key: "applicant.materials_missing",
    name: "Materials reminder",
    category: "Instructor hiring — applicant",
    description: "Reminds an applicant to upload course materials before their interview.",
    defaultSubject: "Action required: upload your course materials before your interview",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Materials needed before your interview</h2>
    <p>Hi {{applicantName}},</p>
    <p>Your interview slot is confirmed — great! To help your interview team prepare, please upload your curriculum prep materials before your session:</p>
    <ul style="color: #44403c; line-height: 2;">
      <li><strong>One-class plan</strong> — a lesson plan for your first session</li>
      <li><strong>Structure notes</strong> — a short outline of how the full class would fit together</li>
    </ul>
    <p>These are helpful context for the team. They are not a blocker for your confirmed interview.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{uploadUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Upload Materials</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">If you've already uploaded these, you can ignore this reminder.</p>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "uploadUrl",
        label: "Materials upload URL",
        sample: "https://portal.youthpassionproject.org/application-status",
        required: true,
      },
    ],
  },

  "applicant.chair_review_queued": {
    key: "applicant.chair_review_queued",
    name: "Application under final review",
    category: "Instructor hiring — applicant",
    description: "Notifies the applicant their application has reached the hiring chair.",
    defaultSubject: "Your YPP instructor application is under final review",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Great news, {{applicantName}}!</h2>
    <p>Your interviews have been completed and your instructor application has been passed to our hiring chair for final review.</p>
    <p>The hiring chair typically completes their review within <strong>up to two weeks</strong>. You will receive another email as soon as a decision has been made.</p>
    <p>In the meantime, you can check your current application status at any time:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{statusUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Thank you for your patience — we appreciate your interest in joining the YPP instructor team.</p>`,
    variables: [VAR_APPLICANT_NAME, VAR_STATUS_URL],
  },

  // ─── Instructor hiring — staff ──────────────────────────────────────────────
  "staff.new_application_notification": {
    key: "staff.new_application_notification",
    name: "New application notification",
    category: "Instructor hiring — staff",
    description:
      "Notifies admins / chapter presidents when a new instructor application is submitted.",
    defaultSubject: "New Instructor Application - {{applicantName}}",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">New Instructor Application</h2>
    <p><strong>{{applicantName}}</strong> has submitted an application to become an instructor at Youth Passion Project.</p>
    <p>Please log in to review their application, check their motivation and experience, and take appropriate action.</p>
    <p style="color: #57534e; font-size: 14px;">Frame the interview as a collaborative conversation about their teaching approach — not a scored exam.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{reviewUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Review Application</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You are receiving this because you are an admin or chapter president.</p>`,
    variables: [
      VAR_APPLICANT_NAME,
      {
        key: "reviewUrl",
        label: "Application review URL",
        sample: "https://portal.youthpassionproject.org/admin/instructor-applicants",
        required: true,
      },
    ],
  },

  "staff.reviewer_assigned": {
    key: "staff.reviewer_assigned",
    name: "Reviewer assigned",
    category: "Instructor hiring — staff",
    description: "Notifies a reviewer they've been assigned to an instructor application.",
    defaultSubject: "You've been assigned to review an instructor application",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Reviewer Assignment</h2>
    <p>Hi {{reviewerName}},</p>
    <p>You have been assigned as the reviewer for <strong>{{applicantName}}</strong>'s instructor application.</p>
    <p>Please complete your structured review when you're ready.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{applicationUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application</a>
    </div>`,
    variables: [
      { key: "reviewerName", label: "Reviewer name", sample: "Alex Rivera", required: true },
      VAR_APPLICANT_NAME,
      {
        key: "applicationUrl",
        label: "Application URL",
        sample: "https://portal.youthpassionproject.org/applications/instructor/123",
        required: true,
      },
    ],
  },

  "staff.interviewer_assigned": {
    key: "staff.interviewer_assigned",
    name: "Interviewer assigned",
    category: "Instructor hiring — staff",
    description: "Notifies an interviewer they've been assigned to an instructor interview.",
    defaultSubject: "You've been assigned as {{roleLabel}} for an instructor interview",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Interviewer Assignment — {{roleLabel}}</h2>
    <p>Hi {{interviewerName}},</p>
    <p>You have been assigned as the <strong>{{roleLabel}}</strong> for <strong>{{applicantName}}</strong>'s instructor interview.</p>
    <p>Please review the applicant's materials and complete your interview evaluation after the session.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{interviewUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Interview Workspace</a>
    </div>`,
    variables: [
      { key: "roleLabel", label: "Interviewer role label", sample: "Lead Interviewer", required: true },
      { key: "interviewerName", label: "Interviewer name", sample: "Alex Rivera", required: true },
      VAR_APPLICANT_NAME,
      {
        key: "interviewUrl",
        label: "Interview workspace URL",
        sample: "https://portal.youthpassionproject.org/applications/instructor/123/interview",
        required: true,
      },
    ],
  },

  "staff.chair_digest": {
    key: "staff.chair_digest",
    name: "Chair queue daily digest",
    category: "Instructor hiring — staff",
    description: "Daily digest for hiring chairs listing applications awaiting a decision.",
    defaultSubject: "Chair Queue: {{pendingCount}} {{applicationWord}} awaiting your decision",
    defaultBody: `
    <h2 style="margin: 0 0 16px; color: #1c1917;">Chair Queue — Daily Digest</h2>
    <p>Hi {{chairName}},</p>
    <p>You have <strong>{{pendingCount}}</strong> instructor {{applicationWord}} awaiting a chair decision.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <thead>
        <tr style="background: #f5f5f4;">
          <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Applicant</th>
          <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Wait time</th>
        </tr>
      </thead>
      <tbody>{{rows}}</tbody>
    </table>
    {{moreNote}}
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{queueUrl}}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Open Chair Queue</a>
    </div>`,
    variables: [
      { key: "chairName", label: "Chair name", sample: "Alex Rivera", required: true },
      { key: "pendingCount", label: "Pending count", sample: "3", required: true },
      {
        key: "applicationWord",
        label: "application / applications word",
        sample: "applications",
        required: true,
      },
      {
        key: "rows",
        label: "Applicant rows (HTML)",
        sample:
          '<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e7e5e4;">Jordan Lee</td><td style="padding: 8px 12px; border-bottom: 1px solid #e7e5e4; color: #44403c;">2d in queue</td></tr>',
        raw: true,
      },
      {
        key: "moreNote",
        label: "Overflow note (HTML)",
        sample: "",
        raw: true,
      },
      {
        key: "queueUrl",
        label: "Chair queue URL",
        sample: "https://portal.youthpassionproject.org/admin/instructor-applicants/chair-queue",
        required: true,
      },
    ],
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
