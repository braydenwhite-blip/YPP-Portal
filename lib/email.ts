import { Resend } from "resend";
import nodemailer from "nodemailer";
import { isHttpUrl } from "@/lib/meeting-details";
import { escapeHtml } from "@/lib/email-templates/interpolate";
import { sendTemplatedEmail } from "@/lib/email-templates/render";
import { chairDecisionTemplateKey } from "@/lib/email-templates/registry";

// Initialize Resend client (lazy - only when API key is set)
let resendClient: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

type EmailProvider = "auto" | "smtp" | "resend";

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  encoding?: string;
  contentId?: string;
  disposition?: "attachment" | "inline";
}

function getEmailProvider(): EmailProvider {
  const raw = (process.env.EMAIL_PROVIDER || "auto").toLowerCase().trim();
  if (raw === "smtp" || raw === "resend" || raw === "auto") return raw;
  return "auto";
}

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "y", "on"].includes(v.toLowerCase().trim());
}

function extractEmailAddress(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

function withResendSenderHint(message: string, from: string) {
  const address = extractEmailAddress(from);
  if (!address.endsWith("@resend.dev")) return message;

  return `${message} EMAIL_FROM is still using Resend's test sender. Verify your domain in Resend and change EMAIL_FROM to a verified address like noreply@yourdomain.com.`;
}

function getDefaultFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;
  // If using SMTP and user forgot to set EMAIL_FROM, fall back to the SMTP user.
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser) return smtpUser;
  return "Youth Passion Project <noreply@youthpassionproject.org>";
}

/**
 * Reply-To address used on outbound mail. A real, monitored Reply-To (e.g. a
 * support inbox) is a positive deliverability signal — mailbox providers treat
 * mail that can be replied to as more legitimate than no-reply-only senders.
 */
function getReplyTo(): string | undefined {
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return replyTo || undefined;
}

/**
 * Build standard bulk-sender deliverability headers. `List-Unsubscribe` (and the
 * one-click `List-Unsubscribe-Post`) are required by Gmail/Yahoo bulk-sender
 * rules and strongly reduce spam-foldering. We add the one-click POST header
 * only when an HTTPS unsubscribe endpoint is configured; a `mailto:` alone is
 * still a valid List-Unsubscribe target on its own.
 *
 * Configure via env:
 *   EMAIL_UNSUBSCRIBE_URL    — HTTPS endpoint that handles one-click POST
 *   EMAIL_UNSUBSCRIBE_MAILTO — fallback/secondary mailto target (address only)
 */
function buildDeliverabilityHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {};

  const url = process.env.EMAIL_UNSUBSCRIBE_URL?.trim();
  const mailto = process.env.EMAIL_UNSUBSCRIBE_MAILTO?.trim();
  const targets: string[] = [];
  if (url && isHttpUrl(url)) targets.push(`<${url}>`);
  if (mailto) targets.push(`<mailto:${mailto}>`);

  if (targets.length > 0) {
    headers["List-Unsubscribe"] = targets.join(", ");
    // One-click only makes sense against an HTTPS endpoint that accepts POST.
    if (url && isHttpUrl(url)) {
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
  }

  return { ...headers, ...extra };
}

function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  );
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) return null;

  if (!smtpTransporter) {
    const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = parseBool(process.env.SMTP_SECURE) || port === 465;

    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return smtpTransporter;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a generic email
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  replyTo,
  headers
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** Override the default Reply-To (falls back to EMAIL_REPLY_TO). */
  replyTo?: string;
  /** Extra SMTP/MIME headers, merged over the standard deliverability set. */
  headers?: Record<string, string>;
}): Promise<EmailResult> {
  const provider = getEmailProvider();
  const from = getDefaultFrom();
  const toList = Array.isArray(to) ? to.join(", ") : to;
  const textBody = text || stripHtml(html);
  const effectiveReplyTo = replyTo ?? getReplyTo();
  const effectiveHeaders = buildDeliverabilityHeaders(headers);
  const hasHeaders = Object.keys(effectiveHeaders).length > 0;
  const normalizedAttachments = attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType,
    encoding: attachment.encoding,
    cid: attachment.contentId,
    contentDisposition: attachment.disposition ?? "attachment",
  }));

  // Provider order:
  // - If EMAIL_PROVIDER is set, honor it.
  // - Otherwise (auto), prefer SMTP if configured, else Resend.
  const trySmtp = provider === "smtp" || (provider === "auto" && isSmtpConfigured());
  const tryResend = provider === "resend" || provider === "auto";

  if (trySmtp) {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      console.warn("[Email] SMTP not configured - email not sent");
      return { success: false, error: "Email service not configured" };
    }
    try {
      const info = await transporter.sendMail({
        from,
        to: toList,
        subject,
        html,
        text: textBody,
        attachments: normalizedAttachments,
        ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
        ...(hasHeaders ? { headers: effectiveHeaders } : {}),
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("[Email] Error sending email via SMTP:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (tryResend) {
    const client = getResendClient();
    if (!client) {
      console.warn("[Email] RESEND_API_KEY not configured - email not sent");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const result = await client.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: textBody,
        attachments: normalizedAttachments as any,
        ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
        ...(hasHeaders ? { headers: effectiveHeaders } : {}),
      });

      if (result.error) {
        console.error("[Email] Failed to send via Resend:", result.error);
        return { success: false, error: withResendSenderHint(result.error.message, from) };
      }

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error("[Email] Error sending email via Resend:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: withResendSenderHint(message, from) };
    }
  }

  return { success: false, error: "Email provider not configured" };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("account.password_reset", to, { name, resetUrl });
}

export async function sendAccountSetupEmail({
  to,
  name,
  roleLabel,
  setupUrl,
}: {
  to: string;
  name: string;
  roleLabel: string;
  setupUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("account.setup", to, {
    name,
    roleLabel,
    roleLabelLower: roleLabel.toLowerCase(),
    setupUrl,
  });
}

export async function sendEmailVerificationEmail({
  to,
  name,
  verifyUrl
}: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("account.email_verification", to, { name, verifyUrl });
}

export async function sendMagicLinkEmail({
  to,
  name,
  magicUrl
}: {
  to: string;
  name: string;
  magicUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("account.magic_link", to, { name, magicUrl });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail({
  to,
  name,
  title,
  body,
  link,
  linkText = "View Details"
}: {
  to: string;
  name: string;
  title: string;
  body: string;
  link?: string;
  linkText?: string;
}): Promise<EmailResult> {
  const linkHtml = link
    ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">${escapeHtml(linkText)}</a>
      </div>`
    : "";

  return sendTemplatedEmail("notification.generic", to, {
    title,
    name,
    body,
    linkHtml,
  });
}

/**
 * Send new message notification email
 */
export async function sendNewMessageEmail({
  to,
  recipientName,
  senderName,
  messagePreview,
  conversationUrl
}: {
  to: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    name: recipientName,
    title: `New Message from ${senderName}`,
    body: `"${messagePreview.length > 100 ? messagePreview.slice(0, 100) + "..." : messagePreview}"`,
    link: conversationUrl,
    linkText: "View Conversation"
  });
}

/**
 * Send mentorship check-in reminder
 */
export async function sendMentorshipReminderEmail({
  to,
  mentorName,
  menteeName,
  dashboardUrl
}: {
  to: string;
  mentorName: string;
  menteeName: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    name: mentorName,
    title: "Mentorship Check-In Reminder",
    body: `It's time for your monthly check-in with ${menteeName}. Please schedule a meeting to discuss their progress and goals.`,
    link: dashboardUrl,
    linkText: "View Mentee Progress"
  });
}

/**
 * Send application status update email
 */
export async function sendApplicationStatusEmail({
  to,
  applicantName,
  positionTitle,
  status,
  message,
  portalUrl
}: {
  to: string;
  applicantName: string;
  positionTitle: string;
  status: "APPROVED" | "DECLINED" | "INTERVIEW_SCHEDULED";
  message?: string;
  portalUrl: string;
}): Promise<EmailResult> {
  const statusMessages: Record<typeof status, { title: string; body: string }> = {
    APPROVED: {
      title: `Congratulations! Your Application Was Approved`,
      body: `Great news! Your application for ${positionTitle} has been approved. Welcome to the team!${message ? ` ${message}` : ""}`
    },
    DECLINED: {
      title: `Application Update: ${positionTitle}`,
      body: `Thank you for your interest in the ${positionTitle} position. After careful consideration, we've decided to move forward with other candidates at this time.${message ? ` ${message}` : ""} We encourage you to apply for future opportunities.`
    },
    INTERVIEW_SCHEDULED: {
      title: `Interview Scheduled: ${positionTitle}`,
      body: `Your application for ${positionTitle} has moved forward! We'd like to schedule an interview with you.${message ? ` ${message}` : ""}`
    }
  };

  const { title, body } = statusMessages[status];

  return sendNotificationEmail({
    to,
    name: applicantName,
    title,
    body,
    link: portalUrl,
    linkText: "View Application"
  });
}

/**
 * Send announcement email
 */
export async function sendAnnouncementEmail({
  to,
  recipientName,
  announcementTitle,
  announcementContent,
  authorName,
  portalUrl
}: {
  to: string;
  recipientName: string;
  announcementTitle: string;
  announcementContent: string;
  authorName: string;
  portalUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("notification.announcement", to, {
    recipientName,
    announcementTitle,
    announcementContent,
    authorName,
    portalUrl,
  });
}

// Utility functions
// `escapeHtml` is imported from `@/lib/email-templates/interpolate` (single
// shared definition used by the template render layer as well).

function renderMeetingDetailsBlock(meetingDetails: string | null | undefined): string {
  const details = meetingDetails?.trim();
  if (!details) return "";

  if (isHttpUrl(details)) {
    return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(details)}" style="background: #16a34a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Join Interview</a>
    </div>`;
  }

  return `
    <div style="background: #f5f5f4; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Meeting details</p>
      <p style="margin: 0; color: #1c1917; font-size: 15px; font-weight: 600;">${escapeHtml(details)}</p>
    </div>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * People Strategy — "New Assignment" notification.
 *
 * Sent immediately when a user is newly added to an ActionAssignment (LEAD /
 * EXECUTING / INPUT). Gated upstream by `ENABLE_ACTION_TRACKER_EMAILS`; this
 * helper only builds the subject/html and delegates to `sendEmail`, exactly
 * like the other `sendXxxEmail` wrappers in this file.
 */
export type ActionAssignmentEmailRole = "LEAD" | "EXECUTING" | "INPUT";

const ACTION_ASSIGNMENT_ROLE_COPY: Record<
  ActionAssignmentEmailRole,
  { label: string; explanation: string }
> = {
  LEAD: {
    label: "Lead",
    explanation: "You are accountable for the outcome and support the executors.",
  },
  EXECUTING: {
    label: "Executing",
    explanation: "You deliver the work and keep the status updated.",
  },
  INPUT: {
    label: "Input",
    explanation: "You give feedback or review when requested.",
  },
};

export async function sendNewAssignmentEmail({
  to,
  recipientName,
  role,
  leadName,
  actionTitle,
  deadline,
  actionUrl,
}: {
  to: string;
  recipientName: string | null;
  role: ActionAssignmentEmailRole;
  leadName: string;
  actionTitle: string;
  deadline: string;
  actionUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  const roleCopy = ACTION_ASSIGNMENT_ROLE_COPY[role];
  return sendTemplatedEmail("action.new_assignment", to, {
    firstName,
    roleLabel: roleCopy.label,
    roleExplanation: roleCopy.explanation,
    actionTitle,
    leadName,
    deadline,
    actionUrl,
  });
}

/**
 * People Strategy — automated Action-Tracker deadline emails.
 *
 * These three `sendXxxEmail` wrappers build the subject/html and delegate to
 * `sendEmail`, exactly like `sendNewAssignmentEmail` above. They are driven by
 * the deadline cron routes (weekly digest, 24-hour warning, deadline-reached)
 * and gated upstream by `ENABLE_ACTION_TRACKER_EMAILS`. Idempotency lives in
 * the caller (`ActionEmailLog`), not here.
 */

/** One row rendered inside the weekly digest, in any of its three groups. */
export type ActionDigestItem = {
  title: string;
  role: string;
  department: string;
  /** Pre-formatted deadline date string. */
  deadline: string;
  actionUrl: string;
};

export type ActionDigestGroups = {
  overdue: ActionDigestItem[];
  dueThisWeek: ActionDigestItem[];
  upcoming: ActionDigestItem[];
};

function renderDigestItemRow(item: ActionDigestItem, accent: string): string {
  return `
    <div style="border-left: 4px solid ${accent}; background: #fafaf9; border-radius: 6px; padding: 12px 16px; margin: 0 0 10px;">
      <a href="${escapeHtml(item.actionUrl)}" style="color: #1c1917; font-size: 15px; font-weight: 600; text-decoration: none;">${escapeHtml(item.title)}</a>
      <p style="margin: 6px 0 0; color: #57534e; font-size: 13px;">
        <strong>Role:</strong> ${escapeHtml(item.role)}
        &nbsp;·&nbsp; <strong>Dept:</strong> ${escapeHtml(item.department)}
        &nbsp;·&nbsp; <strong>Due:</strong> ${escapeHtml(item.deadline)}
      </p>
    </div>`;
}

function renderDigestGroup(
  label: string,
  items: ActionDigestItem[],
  accent: string
): string {
  if (items.length === 0) return "";
  const rows = items.map((i) => renderDigestItemRow(i, accent)).join("");
  return `
    <p style="margin: 22px 0 10px; color: ${accent}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(label)} (${items.length})</p>
    ${rows}`;
}

export async function sendWeeklyActionDigestEmail({
  to,
  recipientName,
  groups,
  myActionsUrl,
}: {
  to: string;
  recipientName: string | null;
  groups: ActionDigestGroups;
  myActionsUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  const total =
    groups.overdue.length + groups.dueThisWeek.length + groups.upcoming.length;
  const groupsHtml = [
    renderDigestGroup("Overdue", groups.overdue, "#dc2626"),
    renderDigestGroup("Due this week", groups.dueThisWeek, "#d97706"),
    renderDigestGroup("Upcoming", groups.upcoming, "#2563eb"),
  ].join("\n");
  return sendTemplatedEmail("action.weekly_digest", to, {
    firstName,
    total: String(total),
    itemWord: total === 1 ? "item" : "items",
    groupsHtml,
    myActionsUrl,
  });
}

/**
 * Render the inline emphasis of the briefing's small markdown subset: `**bold**`
 * and `_italic_`. HTML is escaped FIRST (escapeHtml leaves `*` and `_` intact),
 * so user-derived text in the briefing can never inject markup.
 */
function renderBriefingInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

/**
 * Render the weekly Leadership Briefing markdown (produced by
 * `buildLeadershipBriefing`) into the light HTML the email body uses. The
 * builder emits a known, narrow subset — bold-led section headers, `- ` bullets,
 * a leading italic empty-state note, and plain lines — so a small purpose-built
 * renderer keeps the markdown the single source of truth (shared with the
 * copy-to-clipboard control) without pulling in a markdown dependency.
 */
function renderBriefingHtml(markdown: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (line === "") {
      closeList();
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        out.push('<ul style="margin: 6px 0 0; padding-left: 20px;">');
        inList = true;
      }
      out.push(
        `<li style="margin: 3px 0; color: #1c1917; font-size: 14px;">${renderBriefingInline(line.slice(2))}</li>`
      );
      continue;
    }
    closeList();
    if (line.startsWith("**")) {
      // A bold-led line is a section header (e.g. "**Pulse**", "**Needs attention** (3)").
      out.push(
        `<p style="margin: 16px 0 2px; color: #1c1917; font-size: 14px; font-weight: 700;">${renderBriefingInline(line)}</p>`
      );
      continue;
    }
    out.push(
      `<p style="margin: 2px 0; color: #57534e; font-size: 13px;">${renderBriefingInline(line)}</p>`
    );
  }
  closeList();
  return out.join("\n");
}

/**
 * People Strategy — weekly Leadership Briefing (Phase 6 delivery).
 *
 * Auto-delivers the same shareable briefing that the Command Center "Copy
 * briefing" control produces, so leadership receives the weekly read without
 * opening the portal. Replaces the UX the retired legacy weekly digest provided.
 * The body is rendered from the briefing markdown (single source of truth); the
 * idempotency / recipient selection is owned upstream by the cron. Gated by
 * ENABLE_ACTION_TRACKER_EMAILS at the call site, like the other action emails.
 */
export async function sendLeadershipBriefingEmail({
  to,
  recipientName,
  weekLabel,
  briefingMarkdown,
  commandCenterUrl,
}: {
  to: string;
  recipientName: string | null;
  /** Pre-formatted "Month Day" of the operating week, e.g. "Jun 1". */
  weekLabel: string;
  briefingMarkdown: string;
  commandCenterUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.leadership_briefing", to, {
    firstName,
    weekLabel,
    briefingHtml: renderBriefingHtml(briefingMarkdown),
    commandCenterUrl,
  });
}

export async function sendActionDeadlineWarningEmail({
  to,
  recipientName,
  role,
  department,
  actionTitle,
  deadline,
  updateStatusUrl,
  flagToLeadershipUrl,
}: {
  to: string;
  recipientName: string | null;
  role: string;
  department: string;
  actionTitle: string;
  deadline: string;
  updateStatusUrl: string;
  flagToLeadershipUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.deadline_warning", to, {
    firstName,
    actionTitle,
    role,
    department,
    deadline,
    updateStatusUrl,
    flagToLeadershipUrl,
  });
}

export async function sendActionDeadlineReachedEmail({
  to,
  recipientName,
  role,
  department,
  actionTitle,
  deadline,
  updateStatusUrl,
  flagToLeadershipUrl,
}: {
  to: string;
  recipientName: string | null;
  role: string;
  department: string;
  actionTitle: string;
  deadline: string;
  updateStatusUrl: string;
  flagToLeadershipUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.deadline_reached", to, {
    firstName,
    actionTitle,
    role,
    department,
    deadline,
    updateStatusUrl,
    flagToLeadershipUrl,
  });
}

/** Sent to the Lead when an item passes its deadline with no status update. */
export async function sendActionOverdueLeadEmail({
  to,
  recipientName,
  actionTitle,
  department,
  deadline,
  actionUrl,
}: {
  to: string;
  recipientName: string | null;
  actionTitle: string;
  department: string;
  deadline: string;
  actionUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.overdue_lead", to, {
    firstName,
    actionTitle,
    department,
    deadline,
    actionUrl,
  });
}

/**
 * People Strategy — Leadership escalation notice.
 *
 * Sent to the Leadership / Board when a flagged or OVERDUE action item has gone
 * unresolved for 48h+ and is auto-escalated by the daily escalation cron. One
 * notification per item per recipient — idempotency is enforced upstream by the
 * `escalatedToLeadershipAt` marker and the `ActionEmailLog` dedupe key, so this helper
 * is only ever called once per escalation. Thin wrapper over `sendEmail`.
 */
export async function sendLeadershipEscalationEmail({
  to,
  recipientName,
  actionTitle,
  department,
  leadName,
  statusLabel,
  reason,
  ageLabel,
  deadline,
  queueUrl,
  actionUrl,
}: {
  to: string;
  recipientName: string | null;
  actionTitle: string;
  department: string;
  leadName: string | null;
  statusLabel: string;
  reason: string;
  ageLabel: string;
  deadline: string;
  queueUrl: string;
  actionUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.leadership_escalation", to, {
    firstName,
    reason,
    reasonLower: reason.toLowerCase(),
    ageLabel,
    actionTitle,
    leadName: leadName || "Unassigned",
    department,
    statusLabel,
    deadline,
    queueUrl,
    actionUrl,
  });
}

/**
 * People Strategy — Board escalation roll-up notice.
 *
 * Sent to the Board (SUPER_ADMIN stand-in) when a Leadership-escalated action item has
 * stayed unresolved for 7 days past the Leadership escalation and is auto-rolled-up by
 * the daily escalation cron. One notification per item per recipient —
 * idempotency is enforced upstream by the `boardRolledUpAt` marker and the
 * `ActionEmailLog` dedupe key. Thin wrapper over `sendEmail`.
 */
export async function sendBoardEscalationRollupEmail({
  to,
  recipientName,
  actionTitle,
  department,
  leadName,
  statusLabel,
  daysUnresolvedLabel,
  leadershipEscalatedLabel,
  deadline,
  boardUrl,
  actionUrl,
}: {
  to: string;
  recipientName: string | null;
  actionTitle: string;
  department: string;
  leadName: string | null;
  statusLabel: string;
  daysUnresolvedLabel: string;
  leadershipEscalatedLabel: string;
  deadline: string;
  boardUrl: string;
  actionUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("action.board_rollup", to, {
    firstName,
    leadershipEscalatedLabel,
    actionTitle,
    leadName: leadName || "Unassigned",
    department,
    statusLabel,
    daysUnresolvedLabel,
    deadline,
    boardUrl,
    actionUrl,
  });
}

/**
 * People Strategy — confidential 360 feedback request.
 *
 * Sent to a recent collaborator asking them to submit feedback about a subject
 * member. The link points at the authenticated feedback form; the response is
 * readable only by the Leadership/Board, which the copy makes explicit so colleagues
 * answer candidly. Thin wrapper over `sendEmail`, like the helpers above.
 */
export async function sendFeedbackRequestEmail({
  to,
  recipientName,
  subjectName,
  monthLabel,
  formUrl,
}: {
  to: string;
  recipientName: string | null;
  subjectName: string;
  monthLabel: string;
  formUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("feedback.request", to, {
    firstName,
    subjectName,
    monthLabel,
    formUrl,
  });
}

/**
 * Monthly feedback request email for the reviewable People & Performance
 * workflow. The copy arrives pre-built from `buildFeedbackRequestEmailContent`
 * (lib/people-strategy/feedback-email-content.ts) — the SAME builder the
 * on-screen preview uses, so what Leadership previews is exactly what is sent.
 */
export async function sendMonthlyFeedbackRequestEmail({
  to,
  content,
  formUrl,
}: {
  to: string;
  content: {
    subject: string;
    greeting: string;
    intro: string[];
    workItems: string[];
    closing: string[];
  };
  formUrl: string;
}): Promise<EmailResult> {
  const introHtml = content.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
  const workItemsHtml =
    content.workItems.length > 0
      ? `<ul style="color: #44403c; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 12px 0;">${content.workItems
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`
      : "";
  const closingHtml = content.closing
    .map((p) => `<p style="color: #57534e; font-size: 14px;">${escapeHtml(p)}</p>`)
    .join("\n");

  return sendTemplatedEmail("feedback.monthly_request", to, {
    subject: content.subject,
    greeting: content.greeting,
    introHtml,
    workItemsHtml,
    closingHtml,
    formUrl,
  });
}

/**
 * Notify admins/chapter presidents of a new instructor applicant
 */
export async function sendNewApplicationNotification({
  to,
  applicantName,
  reviewUrl,
}: {
  to: string | string[];
  applicantName: string;
  reviewUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("staff.new_application_notification", to, {
    applicantName,
    reviewUrl,
  });
}

/**
 * Confirmation email sent to the instructor applicant immediately after they submit their application.
 */
export async function sendInstructorApplicationSubmittedEmail({
  to,
  applicantName,
  statusUrl,
}: {
  to: string;
  applicantName: string;
  statusUrl: string;
}): Promise<EmailResult> {
  const firstName = applicantName.split(" ")[0] || applicantName;
  return sendTemplatedEmail("applicant.application_submitted", to, {
    firstName,
    statusUrl,
  });
}

/**
 * Email sent to the applicant when their application is pre-approved (training unlocked).
 * Signals that reviewer + hiring chair have greenlit them; they can now start instructor training.
 */
export async function sendInstructorPreApprovedEmail({
  to,
  applicantName,
  trainingUrl,
}: {
  to: string;
  applicantName: string;
  trainingUrl: string;
}): Promise<EmailResult> {
  const firstName = applicantName.split(" ")[0] || applicantName;
  return sendTemplatedEmail("applicant.pre_approved", to, {
    firstName,
    trainingUrl,
  });
}

/**
 * Notify applicant that their application has been approved
 */
export async function sendApplicationApprovedEmail({
  to,
  applicantName,
}: {
  to: string;
  applicantName: string;
}): Promise<EmailResult> {
  const { getPublicAppUrl } = await import("@/lib/public-app-url");
  const baseUrl = getPublicAppUrl();
  return sendTemplatedEmail("application.approved", to, {
    applicantName,
    trainingUrl: `${baseUrl}/instructor-training`,
  });
}

/**
 * Notify applicant that their application has been rejected
 */
export async function sendApplicationRejectedEmail({
  to,
  applicantName,
  reason,
}: {
  to: string;
  applicantName: string;
  reason: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("application.rejected", to, { applicantName, reason });
}

/**
 * Notify applicant that the reviewer has requested more information
 */
export async function sendInfoRequestEmail({
  to,
  applicantName,
  message,
  statusUrl,
}: {
  to: string;
  applicantName: string;
  message: string;
  statusUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("application.info_request", to, {
    applicantName,
    message,
    statusUrl,
  });
}

/**
 * Notify applicant that an interview has been scheduled.
 */
export async function sendInterviewScheduledEmail({
  to,
  applicantName,
  scheduledAt,
  statusUrl,
  meetingUrl,
  variant = "default",
}: {
  to: string;
  applicantName: string;
  scheduledAt: Date;
  statusUrl: string;
  meetingUrl?: string | null;
  variant?: "default" | "instructor_application";
}): Promise<EmailResult> {
  void variant;
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const meetingBlock = meetingUrl
    ? `
    ${renderMeetingDetailsBlock(meetingUrl)}
    <p style="color: #78716c; font-size: 13px;">You can also find the meeting details on your application status page.</p>`
    : `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(statusUrl)}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a>
    </div>`;
  return sendTemplatedEmail("applicant.interview_scheduled", to, {
    applicantName,
    formattedDate,
    meetingBlock,
  });
}

/**
 * Email to applicant: "A reviewer has proposed times — log in and pick one."
 * Sent after the reviewer submits their offered slots via the admin panel.
 */
export async function sendPickYourTimeEmail({
  to,
  applicantName,
  slots,
  statusUrl,
}: {
  to: string;
  applicantName: string;
  slots: { scheduledAt: Date; durationMinutes: number }[];
  statusUrl: string;
}): Promise<EmailResult> {
  const firstName = applicantName.split(" ")[0] || applicantName;
  const slotRows = slots
    .map((s) => {
      const formatted = s.scheduledAt.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      return `<li style="margin-bottom: 6px;">${escapeHtml(formatted)} (${s.durationMinutes} min)</li>`;
    })
    .join("");
  return sendTemplatedEmail("applicant.pick_your_time", to, {
    firstName,
    slotRows,
    statusUrl,
  });
}

export async function sendInterviewTimesDeclinedEmail({
  to,
  recipientName,
  applicantName,
  workspaceUrl,
}: {
  to: string;
  recipientName: string | null;
  applicantName: string;
  workspaceUrl: string;
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  return sendTemplatedEmail("applicant.interview_times_declined", to, {
    firstName,
    applicantName,
    workspaceUrl,
  });
}

/**
 * Confirmation email sent to the applicant and all reviewers once the applicant picks a slot.
 * Includes an ICS calendar attachment.
 */
export async function sendInterviewConfirmedEmail({
  to,
  recipientName,
  applicantName,
  scheduledAt,
  durationMinutes,
  role,
  detailUrl,
  meetingUrl,
  icsContent,
}: {
  to: string;
  recipientName: string;
  applicantName: string;
  scheduledAt: Date;
  durationMinutes: number;
  role: "applicant" | "reviewer";
  detailUrl: string;
  meetingUrl?: string | null;
  icsContent: string;
}): Promise<EmailResult> {
  const firstName = recipientName.split(" ")[0] || recipientName;
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const heading =
    role === "applicant"
      ? `It's confirmed, ${escapeHtml(firstName)}!`
      : `${escapeHtml(applicantName)} has confirmed their time`;
  const bodyText =
    role === "applicant"
      ? "Your interview is officially booked. This is a collaborative conversation — come prepared to talk about your teaching approach."
      : `${escapeHtml(applicantName)} has selected a time for their interview. A calendar invite is attached.`;
  return sendTemplatedEmail(
    "applicant.interview_confirmed",
    to,
    {
      heading,
      bodyText,
      formattedDate,
      durationMinutes: String(durationMinutes),
      meetingBlock: renderMeetingDetailsBlock(meetingUrl),
      detailUrl,
    },
    {
      attachments: [
        {
          filename: "interview.ics",
          content: icsContent,
          contentType: "text/calendar",
        },
      ],
    }
  );
}

export async function sendInterviewChoiceReminderEmail({
  to,
  applicantName,
  slots,
  statusUrl,
}: {
  to: string;
  applicantName: string;
  slots: { scheduledAt: Date; durationMinutes: number }[];
  statusUrl: string;
}): Promise<EmailResult> {
  const firstName = applicantName.split(" ")[0] || applicantName;
  const slotRows = slots
    .map((slot) => {
      const formatted = slot.scheduledAt.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      return `<li style="margin-bottom: 6px;">${escapeHtml(formatted)} (${slot.durationMinutes} min)</li>`;
    })
    .join("");
  return sendTemplatedEmail("applicant.interview_choice_reminder", to, {
    firstName,
    slotRows,
    statusUrl,
  });
}

export async function sendInstructorInterviewReminderEmail({
  to,
  recipientName,
  applicantName,
  scheduledAt,
  durationMinutes,
  meetingDetails,
  detailUrl,
  role,
  windowLabel,
}: {
  to: string;
  recipientName: string | null;
  applicantName: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingDetails?: string | null;
  detailUrl: string;
  role: "applicant" | "interviewer";
  windowLabel: "24-hour" | "2-hour";
}): Promise<EmailResult> {
  const firstName = recipientName?.split(" ")[0] || "there";
  const subject =
    windowLabel === "24-hour"
      ? "Reminder: Your YPP Interview Is Tomorrow"
      : "Reminder: Your YPP Interview Starts Soon";
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const bodyText =
    role === "applicant"
      ? `Hi ${escapeHtml(firstName)}, this is your ${escapeHtml(windowLabel)} reminder for your YPP interview.`
      : `Hi ${escapeHtml(firstName)}, this is your ${escapeHtml(windowLabel)} reminder that ${escapeHtml(applicantName)} has a YPP interview with you.`;
  return sendTemplatedEmail("applicant.interview_reminder", to, {
    subject,
    bodyText,
    formattedDate,
    durationMinutes: String(durationMinutes),
    meetingBlock: renderMeetingDetailsBlock(meetingDetails),
    detailUrl,
  });
}

// ============================================
// ICS CALENDAR HELPER
// ============================================

interface IcsParams {
  uid: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  meetingLink?: string | null;
  organizerEmail?: string;
  attendeeEmail?: string;
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEscape(s: string): string {
  // RFC 5545: fold long lines and escape special chars
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateIcsContent(params: IcsParams): string {
  const { uid, title, description, startsAt, endsAt, meetingLink, organizerEmail, attendeeEmail } = params;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Youth Passion Project//YPP Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}@ypp-portal`,
    `DTSTART:${formatIcsDate(startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
  ];
  if (meetingLink) {
    if (isHttpUrl(meetingLink)) lines.push(`URL:${meetingLink}`);
    lines.push(`LOCATION:${icsEscape(meetingLink)}`);
  }
  if (organizerEmail) lines.push(`ORGANIZER:MAILTO:${organizerEmail}`);
  if (attendeeEmail) lines.push(`ATTENDEE;RSVP=TRUE:MAILTO:${attendeeEmail}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

// ============================================
// AVAILABILITY REQUEST EMAIL
// ============================================

/**
 * Sent when an admin moves an application to INTERVIEW_SCHEDULED.
 * Prompts the applicant to submit their availability windows.
 */
export async function sendAvailabilityRequestEmail({
  to,
  applicantName,
  statusUrl,
  variant,
}: {
  to: string;
  applicantName: string;
  statusUrl: string;
  variant: "cp" | "instructor";
}): Promise<EmailResult> {
  const isCp = variant === "cp";

  const subject = isCp
    ? "You've been selected for an interview — next steps inside"
    : "Next step: interview time options are coming soon";

  const tagline = isCp
    ? "Your chapter presidency journey just got real."
    : "Your teaching journey with YPP is just getting started.";

  const bodyText = isCp
    ? `YPP chapters are built by people exactly like you — driven, visionary, ready to lead. We've reviewed your application and we want to meet you. The next step is to let us know when you're available so we can lock in a time that works for everyone.`
    : `This isn't a test — it's a conversation. We want to hear how you think about teaching and get to know you better. Your lead interviewer will send exactly 3 proposed times for you to choose from.`;

  const ctaLabel = isCp ? "Submit My Availability" : "View My Application Status";
  const nextStepText = isCp
    ? "Log in, add your available time windows, and we'll automatically match you with a slot — no back-and-forth needed."
    : "Log in to your application status page. When your lead interviewer sends proposed times, you will be able to pick the one that works best.";

  return sendTemplatedEmail("applicant.availability_request", to, {
    subject,
    tagline,
    heading: isCp
      ? `${applicantName}, you've been selected for an interview!`
      : `${applicantName}, you've been invited to interview!`,
    bodyText,
    nextStepText,
    ctaLabel,
    statusUrl,
  });
}

// ============================================
// AUTO-ASSIGNED CONFIRMATION EMAIL (+ .ics)
// ============================================

/**
 * Sent to both applicant and interviewer when auto-matching finds a slot.
 * Includes an .ics calendar attachment.
 */
export async function sendInterviewAutoAssignedEmail({
  to,
  recipientName,
  applicantName,
  scheduledAt,
  meetingLink,
  icsContent,
  variant,
  role,
}: {
  to: string;
  recipientName: string;
  applicantName: string;
  scheduledAt: Date;
  meetingLink: string | null;
  icsContent: string;
  variant: "cp" | "instructor";
  role: "applicant" | "interviewer";
}): Promise<EmailResult> {
  const isCp = variant === "cp";
  const isApplicant = role === "applicant";

  const sessionLabel = isCp ? "interview" : "curriculum review session";
  const sessionLabelCap = isCp ? "Interview" : "Curriculum Review Session";

  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  let subject: string;
  let tagline: string;
  let heading: string;
  let bodyText: string;

  if (isApplicant && isCp) {
    subject = "Your YPP interview is confirmed — add it to your calendar";
    tagline = "The conversation that could change everything.";
    heading = `It's official, ${recipientName}! Your interview is booked.`;
    bodyText = "Come ready to talk about your leadership philosophy, your vision for your chapter, and why you believe in YPP's mission. There are no trick questions — we just want to get to know the leader you already are.";
  } else if (isApplicant && !isCp) {
    subject = "Your curriculum review session is confirmed — see you soon";
    tagline = "Great teaching starts with a great conversation.";
    heading = `Looking forward to meeting you, ${recipientName}!`;
    bodyText = "This is an open conversation about how you teach. We'll discuss your teaching approach, walk through some curriculum, and explore how YPP materials fit your style. Come as you are — curious and prepared to share.";
  } else {
    // Interviewer
    subject = isCp
      ? `Interview scheduled: ${applicantName}`
      : `Curriculum review scheduled: ${applicantName}`;
    tagline = "A new session has been auto-scheduled for you.";
    heading = `A ${sessionLabel} has been auto-scheduled`;
    bodyText = `Your availability matched with ${applicantName}'s submitted windows. The details are below — the calendar invite is attached.`;
  }

  const meetingLinkHtml = meetingLink
    ? `<div style="text-align: center; margin: 20px 0 8px;">
        <a href="${escapeHtml(meetingLink)}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px;">Join Your ${escapeHtml(sessionLabelCap)}</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #78716c; margin: 0 0 24px; word-break: break-all;">${escapeHtml(meetingLink)}</p>`
    : "";

  const icsFilename = isCp ? "interview-details.ics" : "curriculum-review.ics";

  return sendTemplatedEmail(
    "applicant.interview_auto_assigned",
    to,
    {
      subject,
      tagline,
      heading,
      bodyText,
      sessionLabelCap,
      formattedDate,
      meetingLinkHtml,
    },
    {
      attachments: [
        {
          filename: icsFilename,
          content: icsContent,
          contentType: "text/calendar",
          encoding: "utf-8",
          disposition: "attachment",
        },
      ],
    }
  );
}

// ============================================
// NO-MATCH ADMIN NOTIFICATION EMAIL
// ============================================

/**
 * Sent to all admins when auto-matching fails to find an overlapping slot.
 */
export async function sendNoMatchFoundEmail({
  to,
  applicantName,
  adminUrl,
  variant,
}: {
  to: string | string[];
  applicantName: string;
  adminUrl: string;
  variant: "cp" | "instructor";
}): Promise<EmailResult> {
  const sessionLabel = variant === "cp" ? "interview" : "curriculum review session";
  return sendTemplatedEmail("applicant.no_match_found", to, {
    applicantName,
    sessionLabel,
    adminUrl,
  });
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  const provider = getEmailProvider();
  if (provider === "smtp") return isSmtpConfigured();
  if (provider === "resend") return !!process.env.RESEND_API_KEY;
  return isSmtpConfigured() || !!process.env.RESEND_API_KEY;
}

// ─── Instructor Applicant Workflow V1 email templates ─────────────────────────

/**
 * Notify a reviewer they have been assigned to an instructor application.
 */
export async function sendReviewerAssignedEmail(
  userId: string,
  applicationId: string
): Promise<EmailResult> {
  const { prisma } = await import("@/lib/prisma");
  const [user, application] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { applicant: { select: { name: true } } },
    }),
  ]);
  if (!user?.email || !application) return { success: false, error: "User or application not found" };

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  return sendTemplatedEmail("staff.reviewer_assigned", user.email, {
    reviewerName: user.name,
    applicantName: application.applicant.name,
    applicationUrl: `${baseUrl}/applications/instructor/${applicationId}`,
  });
}

/**
 * Notify an interviewer they have been assigned to an instructor application.
 */
export async function sendInterviewerAssignedEmail(
  userId: string,
  applicationId: string,
  role: "LEAD" | "SECOND"
): Promise<EmailResult> {
  const { prisma } = await import("@/lib/prisma");
  const [user, application] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { applicant: { select: { name: true } } },
    }),
  ]);
  if (!user?.email || !application) return { success: false, error: "User or application not found" };

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  const roleLabel = role === "LEAD" ? "Lead Interviewer" : "Second Interviewer";
  return sendTemplatedEmail("staff.interviewer_assigned", user.email, {
    roleLabel,
    interviewerName: user.name,
    applicantName: application.applicant.name,
    interviewUrl: `${baseUrl}/applications/instructor/${applicationId}/interview`,
  });
}

/**
 * Remind applicant to upload required materials after confirming an interview slot.
 */
export async function sendMaterialsMissingReminderEmail(
  applicantEmail: string,
  applicantName: string,
  applicationId: string
): Promise<EmailResult> {
  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  void applicationId;
  return sendTemplatedEmail("applicant.materials_missing", applicantEmail, {
    applicantName,
    uploadUrl: `${baseUrl}/application-status`,
  });
}

/**
 * Daily digest email for HIRING_CHAIR users listing applications awaiting decision.
 */
export async function sendChairDigestEmail(
  chairEmail: string,
  chairName: string,
  pendingCount: number,
  applications: Array<{ applicantName: string; queuedDaysAgo: number }>
): Promise<EmailResult> {
  if (pendingCount === 0) return { success: true };

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();

  const rows = applications
    .slice(0, 10)
    .map(
      (a) =>
        `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e7e5e4;">${escapeHtml(a.applicantName)}</td>` +
        `<td style="padding: 8px 12px; border-bottom: 1px solid #e7e5e4; color: ${a.queuedDaysAgo >= 3 ? "#dc2626" : "#44403c"};">${a.queuedDaysAgo}d in queue</td></tr>`
    )
    .join("");

  const moreNote =
    pendingCount > 10
      ? `<p style="color: #78716c; font-size: 13px;">…and ${pendingCount - 10} more in the queue.</p>`
      : "";

  return sendTemplatedEmail("staff.chair_digest", chairEmail, {
    chairName,
    pendingCount: String(pendingCount),
    applicationWord: pendingCount === 1 ? "application" : "applications",
    rows,
    moreNote,
    queueUrl: `${baseUrl}/admin/instructor-applicants/chair-queue`,
  });
}

/**
 * Notify applicant of a chair decision (APPROVE / REJECT / HOLD / REQUEST_INFO / REQUEST_SECOND_INTERVIEW).
 */
export async function sendChairReviewQueuedEmail({
  to,
  applicantName,
  statusUrl,
}: {
  to: string;
  applicantName: string;
  statusUrl: string;
}): Promise<EmailResult> {
  return sendTemplatedEmail("applicant.chair_review_queued", to, {
    applicantName,
    statusUrl,
  });
}

export async function sendChairDecisionEmail(
  applicantEmail: string,
  applicationId: string,
  action: string
): Promise<EmailResult> {
  const { prisma } = await import("@/lib/prisma");
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: { applicant: { select: { name: true, email: true } } },
  });
  const applicantName = application?.applicant.name ?? "Applicant";
  const to = applicantEmail;

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
  const statusUrl = `${baseUrl}/application-status`;

  return sendTemplatedEmail(chairDecisionTemplateKey(action), to, {
    applicantName,
    statusUrl,
  });
}
