/**
 * Next.js instrumentation hook — runs once at server startup (Node.js runtime only).
 *
 * Reserved for future idempotent startup guards. All previous guards were
 * for Google OAuth columns that have since been removed from the schema.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
}
