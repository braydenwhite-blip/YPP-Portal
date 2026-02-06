import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return new PrismaClient();
  }

  try {
    const url = new URL(databaseUrl);
    const isSupabasePooler =
      url.hostname.includes("pooler.supabase.com") || url.port === "6543";
    const hasPgbouncerFlag = url.searchParams.get("pgbouncer") === "true";

    if (isSupabasePooler && !hasPgbouncerFlag) {
      url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }

      return new PrismaClient({
        datasources: {
          db: {
            url: url.toString()
          }
        }
      });
    }
  } catch {
    // Fall back to the unmodified DATABASE_URL if URL parsing fails.
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
