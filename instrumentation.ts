/**
 * Next.js instrumentation hook — runs once at server startup (Node.js runtime only).
 *
 * Purpose: ensure that columns added in migrations that may not have been applied
 * (e.g. because DIRECT_URL is not configured for prisma migrate deploy in Vercel)
 * are present in the database before any request is served.
 *
 * All statements use IF NOT EXISTS / DO NOTHING so they are fully idempotent.
 */

// Re-export telemetry helpers so instrumentation consumers can use a single import.
export { trackApplicantEvent } from "@/lib/telemetry";
export type { ApplicantTelemetryEvent, ApplicantTelemetryPayload } from "@/lib/telemetry";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("@/lib/prisma");

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oauthProvider" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oauthId" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT`
    );

    // Index is harmless to (re-)create
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "User_oauthProvider_oauthId_idx" ON "User"("oauthProvider", "oauthId")`
    );

    console.log("[instrumentation] OAuth columns verified/applied.");
  } catch (err) {
    // Log but do not crash the server — the migration may have already applied
    // the columns successfully, or a DDL-capable connection is unavailable.
    console.error("[instrumentation] Failed to apply OAuth column guard:", err);
  }
}
