/**
 * Safe {{variable}} interpolation for email templates.
 *
 * This is the single, shared substitution utility used by the email-template
 * render layer. It HTML-escapes every substituted value by default so that
 * user-/applicant-supplied content (names, free-text notes, etc.) can never
 * inject markup into a rendered email body.
 *
 * Previously each `sendXxxEmail` in `lib/email.ts` built HTML inline with raw
 * `${...}` interpolation — some escaped, some not. Routing every template
 * through `interpolate()` closes that gap in one place.
 */

/** HTML-escape a string for safe inclusion in email markup. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type MissingVarBehavior = "keep" | "empty" | "throw";

export interface InterpolateOptions {
  /** HTML-escape each substituted value. Default: true. */
  escape?: boolean;
  /** What to do when a referenced variable has no value. Default: "empty". */
  onMissing?: MissingVarBehavior;
}

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replace `{{var}}` tokens in `template` with values from `vars`.
 *
 * Single-pass replacement: a substituted value that itself contains `{{x}}`
 * is NOT re-interpolated (prevents placeholder-injection via user content).
 */
export function interpolate(
  template: string,
  vars: Record<string, string | null | undefined>,
  opts: InterpolateOptions = {}
): string {
  const escape = opts.escape ?? true;
  const onMissing = opts.onMissing ?? "empty";

  return template.replace(VAR_PATTERN, (match, name: string) => {
    const value = vars[name];
    if (value === undefined || value === null) {
      if (onMissing === "throw") {
        throw new Error(`Missing email template variable: {{${name}}}`);
      }
      if (onMissing === "keep") {
        return match;
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[email-template] missing variable {{${name}}} - rendering empty`);
      }
      return "";
    }
    return escape ? escapeHtml(String(value)) : String(value);
  });
}

/**
 * Interpolate a subject line. Subjects are plain text (not HTML), so values
 * are NOT HTML-escaped, but control characters / newlines are stripped so a
 * value cannot break the header line.
 */
export function interpolateSubject(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  const raw = interpolate(template, vars, { escape: false, onMissing: "empty" });
  return raw
    .split("")
    // Replace control characters (newlines, tabs, etc.) with a space so a
    // value cannot break the Subject header or silently merge two words.
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? " " : ch;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the set of `{{var}}` names referenced in a template string. */
export function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(VAR_PATTERN)) {
    names.add(m[1]);
  }
  return [...names];
}
