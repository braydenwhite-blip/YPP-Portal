/**
 * Email template render layer.
 *
 * Resolves the effective subject/body for a template key — a stored
 * `EmailTemplateOverride` row wins, otherwise the code-defined default from the
 * registry — interpolates `{{variables}}`, and wraps the body in the branded
 * `emailShell`. Send functions in `lib/email.ts` call `sendTemplatedEmail`
 * instead of building HTML inline.
 */
import type { EmailResult } from "@/lib/email";
import { emailShell } from "./shell";
import { interpolate, interpolateSubject } from "./interpolate";
import {
  getEmailTemplateDef,
  type EmailTemplateDef,
} from "./registry";

export interface ResolvedTemplate {
  subject: string;
  /** Inner body HTML (NOT yet wrapped in emailShell). */
  body: string;
  source: "override" | "default";
}

/**
 * Resolve the effective (subject, body) for a template key, preferring an
 * active DB override and falling back to the registry default.
 */
export async function resolveTemplate(key: string): Promise<ResolvedTemplate> {
  const def = requireDef(key);
  try {
    const { prisma } = await import("@/lib/prisma");
    const override = await prisma.emailTemplateOverride.findUnique({
      where: { templateKey: key },
    });
    if (override && override.isActive) {
      return { subject: override.subject, body: override.body, source: "override" };
    }
  } catch (err) {
    // Never let template resolution take down a send — fall back to defaults.
    console.error(`[email-template] override lookup failed for ${key}:`, err);
  }
  return { subject: def.defaultSubject, body: def.defaultBody, source: "default" };
}

export interface RenderedEmail {
  subject: string;
  /** Full HTML including the branded shell. */
  html: string;
  source: "override" | "default";
}

/**
 * Resolve + interpolate + wrap a template into a ready-to-send email.
 */
export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string | null | undefined>
): Promise<RenderedEmail> {
  const resolved = await resolveTemplate(key);
  return renderResolved(resolved, vars);
}

/** Interpolate + wrap an already-resolved template (no DB access). */
export function renderResolved(
  resolved: ResolvedTemplate,
  vars: Record<string, string | null | undefined>
): RenderedEmail {
  const subject = interpolateSubject(resolved.subject, vars);
  const body = interpolate(resolved.body, vars);
  return { subject, html: emailShell(body), source: resolved.source };
}

/**
 * Render a template and send it. The single helper the legacy `sendXxxEmail`
 * wrappers delegate to.
 */
export async function sendTemplatedEmail(
  key: string,
  to: string,
  vars: Record<string, string | null | undefined>
): Promise<EmailResult> {
  const { subject, html } = await renderEmailTemplate(key, vars);
  const { sendEmail } = await import("@/lib/email");
  return sendEmail({ to, subject, html });
}

/**
 * Send a template using a caller-supplied one-off override of the subject/body
 * (inline editing). The override values are treated as the final, already
 * variable-substituted content; they are only wrapped in the branded shell.
 *
 * Callers are responsible for sanitizing `bodyHtml` before passing it here
 * (it originates from a human editing in the UI). See the chair-decision flow.
 */
export async function sendTemplatedEmailWithOverride(
  to: string,
  override: { subject: string; bodyHtml: string }
): Promise<EmailResult> {
  const { sendEmail } = await import("@/lib/email");
  return sendEmail({
    to,
    subject: interpolateSubject(override.subject, {}),
    html: emailShell(override.bodyHtml),
  });
}

function requireDef(key: string): EmailTemplateDef {
  const def = getEmailTemplateDef(key);
  if (!def) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  return def;
}
