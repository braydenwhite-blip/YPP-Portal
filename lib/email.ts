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
  linkText = "View Details"
}: {
  to: string;
  name: string;
  title: string;
  body: string;
  link?: string;
  linkText?: string;
}): Promise<EmailResult> {
  const subject = `${title} - Youth Passion Project`;

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
  const subject = "Your YPP Instructor Application Was Received";
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">Thanks for applying, ${escapeHtml(firstName)}!</h2>
    <p>We received your Youth Passion Project instructor application and we're excited to learn more about you.</p>
    <p>Here's what happens next:</p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>Our review team typically reaches out within <strong>3–5 business days</strong>.</li>
      <li>If we'd like to move forward, you'll be invited to a <strong>curriculum overview/interview</strong> — a relaxed conversation about your teaching approach, not a test or exam.</li>
      <li>After that session, we'll make a final decision on your application.</li>
    </ul>
    <p>In the meantime you can check your application status in the portal at any time.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${statusUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Application Status</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Questions? Reach out to your chapter president or our team.</p>
  `);
  return sendEmail({ to, subject, html });
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
  const subject = "Great News: Your YPP Application Has Been Pre-Approved";
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">You've been pre-approved, ${escapeHtml(firstName)}!</h2>
    <p>We're excited to let you know that your instructor application has been reviewed and pre-approved by our team.</p>
    <p><strong>What this means:</strong></p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>You can now begin your <strong>instructor training</strong> in the portal.</li>
      <li>Once you complete training, we'll schedule your <strong>curriculum overview/interview</strong> — a collaborative session where you'll walk through how you'd teach using YPP materials.</li>
      <li>After that session, we'll finalize your application and onboard you as a YPP instructor.</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${trainingUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Instructor Training</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">Welcome to the journey — we're looking forward to working with you!</p>
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
  const { getPublicAppUrl } = await import("@/lib/public-app-url");
  const baseUrl = getPublicAppUrl();
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
  const subject = "Action Needed: Pick a Time for Your Curriculum Overview/Interview";
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
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">Choose your time, ${escapeHtml(firstName)}!</h2>
    <p>Great news — a reviewer would like to schedule your curriculum overview/interview session. This is a relaxed conversation about your teaching approach, not an exam.</p>
    <p><strong>Proposed times:</strong></p>
    <ul style="color: #57534e; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      ${slotRows}
    </ul>
    <p>Log in to the portal and pick the time that works best for you.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${statusUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Choose Your Time</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">If none of these times work, please reach out to your chapter president or reviewer directly.</p>
  `);
  return sendEmail({ to, subject, html });
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
  icsContent,
}: {
  to: string;
  recipientName: string;
  applicantName: string;
  scheduledAt: Date;
  durationMinutes: number;
  role: "applicant" | "reviewer";
  detailUrl: string;
  icsContent: string;
}): Promise<EmailResult> {
  const firstName = recipientName.split(" ")[0] || recipientName;
  const subject = "Confirmed: Curriculum Overview/Interview Scheduled";
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
  const body =
    role === "applicant"
      ? "Your curriculum overview/interview is officially booked. This is a collaborative conversation — come prepared to talk about your teaching approach and how you'd use YPP materials."
      : `${escapeHtml(applicantName)} has selected a time for their curriculum overview/interview. A calendar invite is attached.`;
  const html = emailShell(`
    <h2 style="margin: 0 0 16px; color: #1c1917;">${heading}</h2>
    <p>${body}</p>
    <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1c1917;">${escapeHtml(formattedDate)}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #78716c;">Duration: ${durationMinutes} minutes</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${detailUrl}" style="background: #6b21c8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Details</a>
    </div>
    <p style="color: #78716c; font-size: 13px;">A calendar invite (.ics) is attached to this email.</p>
  `);
  return sendEmail({
    to,
    subject,
    html,
    attachments: [
      {
        filename: "curriculum-overview.ics",
        content: icsContent,
        contentType: "text/calendar",
      },
    ],
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
  if (meetingLink) lines.push(`URL:${meetingLink}`, `LOCATION:${icsEscape(meetingLink)}`);
  if (organizerEmail) lines.push(`ORGANIZER:MAILTO:${organizerEmail}`);
  if (attendeeEmail) lines.push(`ATTENDEE;RSVP=TRUE:MAILTO:${attendeeEmail}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

// ============================================
// BRANDED EMAIL SHELL (upgraded)
// ============================================

/**
 * Bold, branded YPP email shell with deep purple gradient header and tagline.
 */
function brandedShell(opts: { tagline: string; body: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f7ff;">
  <div style="background: linear-gradient(135deg, #4c1d95 0%, #6b21c8 50%, #7c3aed 100%); padding: 40px 36px 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 10px;">Youth Passion Project</div>
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">YPP Pathways Portal</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 14px; font-style: italic;">${escapeHtml(opts.tagline)}</p>
  </div>
  <div style="background: #ffffff; padding: 36px; border: 1px solid #ede9fe; border-top: none; border-radius: 0 0 16px 16px;">
    ${opts.body}
  </div>
  <p style="text-align: center; color: #a78bfa; font-size: 11px; margin-top: 20px; letter-spacing: 0.05em;">
    Youth Passion Project &middot; Empowering youth through passion.<br>
    <span style="color: #78716c;">This is an automated notification from the YPP Pathways Portal.</span>
  </p>
</body>
</html>`;
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
    : "Next step: schedule your curriculum review session";

  const tagline = isCp
    ? "Your chapter presidency journey just got real."
    : "Your teaching journey with YPP is just getting started.";

  const heading = isCp
    ? `${escapeHtml(applicantName)}, you've been selected for an interview!`
    : `${escapeHtml(applicantName)}, you've been invited for a curriculum review session!`;

  const bodyText = isCp
    ? `YPP chapters are built by people exactly like you — driven, visionary, ready to lead. We've reviewed your application and we want to meet you. The next step is to let us know when you're available so we can lock in a time that works for everyone.`
    : `This isn't a test — it's a conversation. We want to hear how you think about teaching, explore how our curriculum aligns with your approach, and get to know you better. Share a few times that work for you and we'll take it from there.`;

  const ctaLabel = isCp ? "Submit My Availability" : "Choose My Available Times";

  const html = brandedShell({
    tagline,
    body: `
      <h2 style="margin: 0 0 20px; color: #1c1917; font-size: 22px; font-weight: 800;">${heading}</h2>
      <p style="margin: 0 0 20px; color: #44403c; font-size: 15px; line-height: 1.7;">${escapeHtml(bodyText)}</p>
      <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
        <p style="margin: 0; font-size: 14px; color: #5b21b6; font-weight: 600;">What happens next?</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #44403c;">Log in, add your available time windows, and we'll automatically match you with a slot — no back-and-forth needed.</p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${escapeHtml(statusUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">${escapeHtml(ctaLabel)}</a>
      </div>
      <p style="margin: 0; font-size: 13px; color: #78716c; text-align: center;">Can't click the button? Copy this link into your browser:<br><span style="color: #7c3aed; word-break: break-all;">${escapeHtml(statusUrl)}</span></p>
    `,
  });

  return sendEmail({ to, subject, html });
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
    heading = `It's official, ${escapeHtml(recipientName)}! Your interview is booked.`;
    bodyText = "Come ready to talk about your leadership philosophy, your vision for your chapter, and why you believe in YPP's mission. There are no trick questions — we just want to get to know the leader you already are.";
  } else if (isApplicant && !isCp) {
    subject = "Your curriculum review session is confirmed — see you soon";
    tagline = "Great teaching starts with a great conversation.";
    heading = `Looking forward to meeting you, ${escapeHtml(recipientName)}!`;
    bodyText = "This is an open conversation about how you teach. We'll discuss your teaching approach, walk through some curriculum, and explore how YPP materials fit your style. Come as you are — curious and prepared to share.";
  } else {
    // Interviewer
    subject = isCp
      ? `Interview scheduled: ${escapeHtml(applicantName)}`
      : `Curriculum review scheduled: ${escapeHtml(applicantName)}`;
    tagline = "A new session has been auto-scheduled for you.";
    heading = `A ${sessionLabel} has been auto-scheduled`;
    bodyText = `Your availability matched with ${escapeHtml(applicantName)}'s submitted windows. The details are below — the calendar invite is attached.`;
  }

  const meetingLinkHtml = meetingLink
    ? `<div style="text-align: center; margin: 20px 0 8px;">
        <a href="${escapeHtml(meetingLink)}" style="display: inline-block; background: #6b21c8; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px;">Join Your ${escapeHtml(sessionLabelCap)}</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #78716c; margin: 0 0 24px; word-break: break-all;">${escapeHtml(meetingLink)}</p>`
    : "";

  const icsFilename = isCp ? "interview-details.ics" : "curriculum-review.ics";

  const html = brandedShell({
    tagline,
    body: `
      <h2 style="margin: 0 0 20px; color: #1c1917; font-size: 22px; font-weight: 800;">${heading}</h2>
      <p style="margin: 0 0 20px; color: #44403c; font-size: 15px; line-height: 1.7;">${escapeHtml(bodyText)}</p>
      <div style="background: #f5f3ff; border-radius: 10px; padding: 20px; margin: 0 0 20px; text-align: center; border: 1px solid #ede9fe;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #7c3aed;">Your ${escapeHtml(sessionLabelCap)}</p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #4c1d95;">${escapeHtml(formattedDate)}</p>
      </div>
      ${meetingLinkHtml}
      <p style="margin: 0; font-size: 13px; color: #78716c; text-align: center;">The calendar invite (.ics file) is attached — open it to add this event to your calendar.</p>
    `,
  });

  return sendEmail({
    to,
    subject,
    html,
    attachments: [
      {
        filename: icsFilename,
        content: icsContent,
        contentType: "text/calendar",
        encoding: "utf-8",
        disposition: "attachment",
      },
    ],
  });
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
  const subject = `[Action needed] No matching slot found for ${applicantName}`;

  const html = brandedShell({
    tagline: "Scheduling needs your attention.",
    body: `
      <h2 style="margin: 0 0 16px; color: #1c1917; font-size: 20px; font-weight: 800;">Scheduling couldn't auto-complete for ${escapeHtml(applicantName)}</h2>
      <p style="margin: 0 0 16px; color: #44403c; font-size: 15px; line-height: 1.7;">
        ${escapeHtml(applicantName)} submitted their availability windows for a ${escapeHtml(sessionLabel)}, but no overlap was found with the assigned reviewer's schedule.
      </p>
      <div style="background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">What to do</p>
        <ul style="margin: 8px 0 0; padding: 0 0 0 18px; font-size: 14px; color: #78350f; line-height: 1.8;">
          <li>The applicant has been prompted to add more availability windows and will retry automatically.</li>
          <li>You can also manually schedule the ${escapeHtml(sessionLabel)} from the admin panel.</li>
          <li>Or ask the assigned reviewer to expand their availability rules.</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${escapeHtml(adminUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px;">View Application</a>
      </div>
    `,
  });

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
