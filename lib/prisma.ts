import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };
const globalForPrismaWarnings = global as unknown as {
  prismaRuntimeUrlWarningShown?: boolean;
};

const DEFAULT_TRANSACTION_POOL_CONNECTION_LIMIT = "5";
const DEFAULT_TRANSACTION_POOL_TIMEOUT = "20";

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
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set(
          "connection_limit",
          getPositiveIntegerEnv(
            "PRISMA_CONNECTION_LIMIT",
            DEFAULT_TRANSACTION_POOL_CONNECTION_LIMIT,
          ),
        );
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
