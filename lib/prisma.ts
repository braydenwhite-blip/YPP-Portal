import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function isSupabasePoolerUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    return host.includes("pooler.supabase.com") || url.port === "6543";
  } catch {
    return false;
  }
}

function normalizeDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const isSupabaseHost =
      host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
    const isSupabasePooler =
      host.includes("pooler.supabase.com") || url.port === "6543";

    // Supabase connections require SSL from serverless runtimes.
    if (isSupabaseHost && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    // Transaction poolers (e.g. Supabase PgBouncer) need Prisma flags.
    if (isSupabasePooler) {
      if (url.searchParams.get("pgbouncer") !== "true") {
        url.searchParams.set("pgbouncer", "true");
      }
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }

    return url.toString();
  } catch {
    // Keep original value when URL parsing fails.
    return rawUrl;
  }
}

function getRuntimeDatabaseUrl(): string | undefined {
  const explicitRuntimeUrl = process.env.PRISMA_RUNTIME_DATABASE_URL?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  // If DATABASE_URL points to Supabase pooler and DIRECT_URL exists,
  // prefer DIRECT_URL for runtime reliability.
  const shouldPreferDirectUrl =
    !explicitRuntimeUrl &&
    Boolean(databaseUrl) &&
    Boolean(directUrl) &&
    isSupabasePoolerUrl(databaseUrl as string);
  const selectedUrl = shouldPreferDirectUrl
    ? directUrl
    : explicitRuntimeUrl || databaseUrl || directUrl;

  if (!selectedUrl) return undefined;
  return normalizeDatabaseUrl(selectedUrl);
}

function createPrismaClient(): PrismaClient {
  const runtimeUrl = getRuntimeDatabaseUrl();
  if (!runtimeUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: runtimeUrl
      }
    }
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
