import { sendEmail } from "@/lib/email";
import {
  buildCalendarAttachment,
  type CalendarInviteInput,
} from "@/lib/scheduling/calendar";

type SchedulingEmailDetail = {
  label: string;
  value: string;
};

type SchedulingEmailInput = {
  to: string;
  recipientName?: string | null;
  subject: string;
  eyebrow?: string;
  heading: string;
  message: string;
  details?: readonly SchedulingEmailDetail[];
  actionUrl?: string | null;
  actionLabel?: string;
  footer?: string;
  calendar?: CalendarInviteInput | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDetails(details: readonly SchedulingEmailDetail[]) {
  if (details.length === 0) return "";

  return `
    <div style="margin: 24px 0; border: 1px solid #e7e5e4; border-radius: 14px; overflow: hidden;">
      ${details
        .map(
          (detail, index) => `
            <div style="display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; background: ${index % 2 === 0 ? "#fafaf9" : "#ffffff"};">
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c;">${escapeHtml(detail.label)}</span>
              <span style="font-size: 14px; font-weight: 600; color: #1c1917; text-align: right;">${escapeHtml(detail.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

export async function sendSchedulingLifecycleEmail(input: SchedulingEmailInput) {
  const details = input.details ?? [];
  const attachments = input.calendar ? [buildCalendarAttachment(input.calendar)] : undefined;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f4;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 20px 20px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
    <p style="color: rgba(255,255,255,0.86); margin: 10px 0 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(input.eyebrow ?? "Scheduling Update")}</p>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 20px 20px;">
    ${
      input.recipientName
        ? `<p style="margin: 0 0 10px; color: #57534e; font-size: 14px;">Hi ${escapeHtml(input.recipientName)},</p>`
        : ""
    }
    <h2 style="margin: 0 0 16px; color: #1c1917;">${escapeHtml(input.heading)}</h2>
    <p style="margin: 0; white-space: pre-wrap; color: #44403c;">${escapeHtml(input.message)}</p>
    ${renderDetails(details)}
    ${
      input.actionUrl
        ? `<div style="text-align: center; margin: 28px 0 24px;">
            <a href="${escapeHtml(input.actionUrl)}" style="display: inline-block; background: #6b21c8; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600;">${escapeHtml(input.actionLabel ?? "Open Portal")}</a>
          </div>`
        : ""
    }
    ${
      input.calendar
        ? `<p style="margin: 0 0 18px; color: #57534e; font-size: 13px;">A calendar invite is attached so you can keep this on your schedule.</p>`
        : ""
    }
    ${
      input.footer
        ? `<p style="margin: 0; color: #78716c; font-size: 12px;">${escapeHtml(input.footer)}</p>`
        : `<p style="margin: 0; color: #78716c; font-size: 12px;">This is a transactional scheduling email from Youth Passion Project.</p>`
    }
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html,
    attachments,
  });
}
