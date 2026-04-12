import { Resend } from "resend";
import nodemailer from "nodemailer";

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
  attachments
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<EmailResult> {
  const provider = getEmailProvider();
  const from = getDefaultFrom();
  const toList = Array.isArray(to) ? to.join(", ") : to;
  const textBody = text || stripHtml(html);
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
  const subject = "Reset Your Password - Youth Passion Project";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <h2 style="margin: 0 0 16px; color: #1c1917;">Reset Your Password</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Reset Password</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">${escapeHtml(resetUrl)}</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
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
  const subject = `Set Up Your ${roleLabel} Account - Youth Passion Project`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <h2 style="margin: 0 0 16px; color: #1c1917;">Finish Setting Up Your Account</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>A Youth Passion Project ${escapeHtml(roleLabel.toLowerCase())} account has been prepared for you.</p>
    <p>Click the button below to choose your password and finish signing in for the first time.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(setupUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Set Up Account</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link is single-use. If you did not expect this account, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">${escapeHtml(setupUrl)}</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
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
  const subject = "Verify Your Email - Youth Passion Project";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <h2 style="margin: 0 0 16px; color: #1c1917;">Verify Your Email Address</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thanks for signing up! Click the button below to verify your email and activate your account:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Verify Email Address</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">${escapeHtml(verifyUrl)}</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
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
  const subject = "Your Magic Sign-In Link - Youth Passion Project";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <h2 style="margin: 0 0 16px; color: #1c1917;">Sign In to Your Account</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Click the button below to sign in instantly — no password needed. This link is single-use and expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(magicUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">Sign In Now</a>
    </div>
    <p style="color: #78716c; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #6b21c8; font-size: 12px; word-break: break-all;">${escapeHtml(magicUrl)}</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
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
  linkText = "View Details",
  subjectPrefix = "",
}: {
  to: string;
  name: string;
  title: string;
  body: string;
  link?: string;
  linkText?: string;
  subjectPrefix?: string;
}): Promise<EmailResult> {
  const subject = `${subjectPrefix}${title} - Youth Passion Project`;

  const linkHtml = link
    ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">${escapeHtml(linkText)}</a>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <h2 style="margin: 0 0 16px; color: #1c1917;">${escapeHtml(title)}</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>${escapeHtml(body)}</p>
    ${linkHtml}
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">This email was sent from the YPP Pathways Portal. Notification delivery follows a fixed portal-wide policy.</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
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
  const subject = `Announcement: ${announcementTitle} - Youth Passion Project`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">New Announcement</p>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="color: #78716c; font-size: 13px; margin: 0 0 8px;">Hi ${escapeHtml(recipientName)},</p>
    <h2 style="margin: 0 0 16px; color: #1c1917;">${escapeHtml(announcementTitle)}</h2>
    <p style="white-space: pre-wrap;">${escapeHtml(announcementContent)}</p>
    <p style="color: #78716c; font-size: 13px; margin-top: 24px;">— ${escapeHtml(authorName)}</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(portalUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">View in Portal</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
    <p style="color: #78716c; font-size: 12px; margin: 0;">You received this because you're a member of Youth Passion Project. Notification delivery follows a fixed portal-wide policy.</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, html });
}

// Utility functions
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const emailShell = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    ${body}
  </div>
  <p style="text-align: center; color: #78716c; font-size: 12px; margin-top: 24px;">Youth Passion Project · This is an automated notification.</p>
</body>
</html>`;

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
  const subject = `New Instructor Application - ${applicantName}`;
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">New Instructor Application</h2>
    <p><strong>${applicantName}</strong> has submitted an application to become an instructor at Youth Passion Project.</p>
    <p>Please log in to review their application, check their motivation and experience, and take appropriate action.</p>
    <p style="color: #57534e; font-size: 14px;">When you schedule the curriculum overview, frame it as a collaborative conversation about their teaching approach — not a scored interview or exam.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${reviewUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Review Application</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">You are receiving this because you are an admin or chapter president.</p>
  `);
  return sendEmail({ to, subject, html });
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
  const subject = "Your YPP Instructor Application Has Been Approved!";
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">Congratulations, ${applicantName}!</h2>
    <p>We are thrilled to let you know that your application to become an instructor at Youth Passion Project has been <strong>approved</strong>.</p>
    <p>You can now log in to the portal and begin your instructor training. Once you complete training and your interview, you will be fully certified to teach.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${baseUrl}/instructor-training" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Instructor Training</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Welcome to the team! We look forward to working with you.</p>
  `);
  return sendEmail({ to, subject, html });
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
  const subject = "Update on Your YPP Instructor Application";
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">Thank You for Applying, ${applicantName}</h2>
    <p>Thank you for your interest in becoming an instructor at Youth Passion Project. After careful consideration, we are unfortunately not moving forward with your application at this time.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #44403c;"><strong>Reviewer notes:</strong> ${reason}</p>
    </div>
    <p>We encourage you to reapply in the future as your situation or our needs change. Thank you again for your interest in our mission.</p>
  `);
  return sendEmail({ to, subject, html });
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
  const subject = "YPP Needs More Information About Your Application";
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">Additional Information Needed</h2>
    <p>Hi ${applicantName}, a reviewer has reviewed your instructor application and has a follow-up question or request before proceeding.</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #44403c;"><strong>Message from reviewer:</strong></p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #1c1917;">${message}</p>
    </div>
    <p>Please log in to your application status page to submit your response.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${statusUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Respond to Request</a>
    </div>
  `);
  return sendEmail({ to, subject, html });
}

/**
 * Notify applicant that an interview (or instructor curriculum overview session) has been scheduled.
 */
export async function sendInterviewScheduledEmail({
  to,
  applicantName,
  scheduledAt,
  statusUrl,
  variant = "default",
}: {
  to: string;
  applicantName: string;
  scheduledAt: Date;
  statusUrl: string;
  /** Instructor applications use curriculum-overview wording; chapter president and other flows stay on "interview". */
  variant?: "default" | "instructor_application";
}): Promise<EmailResult> {
  const isInstructorCurriculum = variant === "instructor_application";
  const subject = isInstructorCurriculum
    ? "Your YPP Curriculum Overview Session Has Been Scheduled"
    : "Your YPP Interview Has Been Scheduled";
  const formattedDate = scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">${
      isInstructorCurriculum ? "Curriculum overview scheduled" : "Interview scheduled"
    }, ${applicantName}!</h2>
    <p>${
      isInstructorCurriculum
        ? "Great news — your curriculum overview session with the review team has been scheduled. This is a chance to walk through your teaching approach and how you would use YPP materials, not a test."
        : "Great news — your interview has been scheduled."
    }</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1c1917;">${formattedDate}</p>
    </div>
    <p>You can view your full application status and any additional details in the portal.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${statusUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">If you have questions, please reach out to your chapter president or admin.</p>
  `);
  return sendEmail({ to, subject, html });
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
