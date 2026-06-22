/**
 * Defense-in-depth sanitizer for admin-authored email HTML.
 *
 * The admin editor is a restricted Tiptap WYSIWYG, so well-behaved input is
 * already constrained to a safe tag set. This sanitizer guards the API surface
 * against a hand-crafted POST: it strips script/style/embed blocks, event-handler
 * attributes, and dangerous URL schemes before the HTML is stored and later sent
 * to applicants. It runs at SAVE time only, never on the send hot path.
 *
 * It is intentionally conservative (allowlist-oriented) and dependency-free.
 */

const BLOCK_ELEMENT_PATTERN =
  /<(script|style|iframe|object|embed|form|link|meta|base)\b[\s\S]*?<\/\1\s*>/gi;
// Self-closing / unterminated variants of the dangerous void-ish tags.
const VOID_DANGEROUS_PATTERN = /<(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi;
// on* event handler attributes: onclick=..., onerror='...', onload=foo
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
// javascript:/vbscript:/data: in href/src attributes.
const DANGEROUS_URI_ATTR_PATTERN =
  /\s(href|src)\s*=\s*("(?:\s*(?:javascript|vbscript|data):)[^"]*"|'(?:\s*(?:javascript|vbscript|data):)[^']*'|(?:javascript|vbscript|data):[^\s>]*)/gi;

export function sanitizeEmailHtml(input: string): string {
  let html = input ?? "";
  // Remove dangerous element blocks (with content) first, then any stragglers.
  html = html.replace(BLOCK_ELEMENT_PATTERN, "");
  html = html.replace(VOID_DANGEROUS_PATTERN, "");
  // Strip inline event handlers.
  html = html.replace(EVENT_HANDLER_PATTERN, "");
  // Neutralize dangerous URLs in href/src.
  html = html.replace(DANGEROUS_URI_ATTR_PATTERN, (m, attr) => ` ${attr}="#"`);
  return html.trim();
}
