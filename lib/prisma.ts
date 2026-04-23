import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };
const globalForPrismaWarnings = global as unknown as {
  prismaRuntimeUrlWarningShown?: boolean;
};

const DEFAULT_TRANSACTION_POOL_CONNECTION_LIMIT = "10";
// Fail fast on pool exhaustion so a slow request surfaces an error the
// caller can degrade from, instead of hanging for the full Vercel 30s
// function budget and timing out with no useful stack.
const DEFAULT_TRANSACTION_POOL_TIMEOUT = "8";
// connection_limit values below this are almost certainly copy-pasted from old
// docs (many README examples used `connection_limit=1`). On Vercel serverless
// with Supabase's transaction pooler, a single-slot pool deadlocks any page
// that fires more than one parallel Prisma call (Prisma P2024).
const MIN_SAFE_CONNECTION_LIMIT = 5;

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isSupabaseTransactionPoolerUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  return Boolean(
    url &&
      url.hostname.toLowerCase().includes("pooler.supabase.com") &&
      url.port === "6543"
  );
}

function isSupabaseSessionPoolerUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  return Boolean(
    url &&
      url.hostname.toLowerCase().includes("pooler.supabase.com") &&
      url.port === "5432"
  );
}

function describeConnectionTarget(rawUrl: string): string {
  const url = parseUrl(rawUrl);
  if (!url) return "invalid URL";
  return `${url.hostname}:${url.port || "(default)"}`;
}

function warnOnce(message: string) {
  if (globalForPrismaWarnings.prismaRuntimeUrlWarningShown) return;
  globalForPrismaWarnings.prismaRuntimeUrlWarningShown = true;
  console.warn(message);
}

function getPositiveIntegerEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (/^[1-9]\d*$/.test(value)) return value;
  return fallback;
}

function warnIfDatabaseUrlsLookWrong(params: {
  explicitRuntimeUrl?: string;
  databaseUrl?: string;
  directUrl?: string;
}) {
  const { explicitRuntimeUrl, databaseUrl, directUrl } = params;

  if (!explicitRuntimeUrl && databaseUrl && isSupabaseSessionPoolerUrl(databaseUrl)) {
    warnOnce(
      `[prisma] DATABASE_URL points to Supabase session pooler ` +
        `(${describeConnectionTarget(databaseUrl)}). Use the transaction pooler on port 6543 for runtime queries.`
    );
    return;
  }

  if (!explicitRuntimeUrl && directUrl && isSupabaseSessionPoolerUrl(directUrl)) {
    warnOnce(
      `[prisma] DIRECT_URL points to Supabase session pooler ` +
        `(${describeConnectionTarget(directUrl)}). DIRECT_URL should use the direct database host for migrations.`
    );
  }
}

function normalizeDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const isSupabaseHost =
      host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
    const isSupabaseTransactionPooler = isSupabaseTransactionPoolerUrl(rawUrl);

    // Supabase connections require SSL from serverless runtimes.
    if (isSupabaseHost && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    // Transaction poolers (e.g. Supabase PgBouncer) need Prisma flags.
    if (isSupabaseTransactionPooler) {
      if (url.searchParams.get("pgbouncer") !== "true") {
        url.searchParams.set("pgbouncer", "true");
      }

      const desiredConnectionLimit = getPositiveIntegerEnv(
        "PRISMA_CONNECTION_LIMIT",
        DEFAULT_TRANSACTION_POOL_CONNECTION_LIMIT,
      );
      const existingConnectionLimit = url.searchParams.get("connection_limit");
      const existingConnectionLimitNum = existingConnectionLimit
        ? Number.parseInt(existingConnectionLimit, 10)
        : Number.NaN;
      if (
        !existingConnectionLimit ||
        !Number.isFinite(existingConnectionLimitNum) ||
        existingConnectionLimitNum < MIN_SAFE_CONNECTION_LIMIT
      ) {
        if (existingConnectionLimit) {
          warnOnce(
            `[prisma] Overriding DATABASE_URL connection_limit=${existingConnectionLimit} ` +
              `with ${desiredConnectionLimit}. Single-connection pools deadlock parallel queries ` +
              `on Vercel serverless. Set PRISMA_CONNECTION_LIMIT to override explicitly.`,
          );
        }
        url.searchParams.set("connection_limit", desiredConnectionLimit);
      }

      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set(
          "pool_timeout",
          getPositiveIntegerEnv("PRISMA_POOL_TIMEOUT", DEFAULT_TRANSACTION_POOL_TIMEOUT),
        );
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

  warnIfDatabaseUrlsLookWrong({ explicitRuntimeUrl, databaseUrl, directUrl });

  // Runtime queries should prefer the pooled DATABASE_URL.
  // DIRECT_URL is reserved for migrations and other non-serverless access.
  const selectedUrl = explicitRuntimeUrl || databaseUrl || directUrl;

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
