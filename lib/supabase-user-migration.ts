import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

type MigrationLog = {
  email: string;
  status: "migrated" | "linked" | "skipped" | "failed" | "dry_run";
  detail: string;
};

export type SupabaseUserMigrationSummary = {
  found: number;
  migrated: number;
  linked: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  logs: MigrationLog[];
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function migrateUsersToSupabaseAuth(options?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<SupabaseUserMigrationSummary> {
  const dryRun = options?.dryRun ?? false;
  const supabase = getSupabaseAdminClient();

  const users = await prisma.user.findMany({
    where: { supabaseAuthId: null },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerified: true,
      primaryRole: true,
      chapterId: true,
    },
    orderBy: { createdAt: "asc" },
    ...(options?.limit ? { take: options.limit } : {}),
  });

  const summary: SupabaseUserMigrationSummary = {
    found: users.length,
    migrated: 0,
    linked: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    logs: [],
  };

  for (const user of users) {
    const email = user.email.trim().toLowerCase();
    const hasPassword = user.passwordHash && user.passwordHash.length > 0;

    if (!email) {
      summary.skipped++;
      summary.logs.push({
        email: `(blank:${user.id})`,
        status: "skipped",
        detail: "User has a blank email address and cannot be imported into Supabase Auth.",
      });
      continue;
    }

    if (dryRun) {
      summary.logs.push({
        email,
        status: "dry_run",
        detail: `Would migrate (password: ${hasPassword ? "yes" : "no"}).`,
      });
      summary.migrated++;
      continue;
    }

    try {
      const payload: Record<string, unknown> = {
        email,
        email_confirm: !!user.emailVerified,
        user_metadata: {
          name: user.name,
          primaryRole: user.primaryRole,
          chapterId: user.chapterId,
          prismaUserId: user.id,
        },
      };

      if (hasPassword) {
        payload.password_hash = user.passwordHash;
      }

      const { data, error } = await supabase.auth.admin.createUser(payload as any);

      if (error) {
        if (error.message?.includes("already been registered")) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (candidate: { email?: string | null; id: string }) => candidate.email === email
          );

          if (existing) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseAuthId: existing.id },
            });

            summary.linked++;
            summary.logs.push({
              email,
              status: "linked",
              detail: `Linked existing Supabase user ${existing.id}.`,
            });
            continue;
          }
        }

        summary.failed++;
        summary.logs.push({
          email,
          status: "failed",
          detail: error.message,
        });
        continue;
      }

      if (!data.user) {
        summary.failed++;
        summary.logs.push({
          email,
          status: "failed",
          detail: "No user returned from Supabase.",
        });
        continue;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseAuthId: data.user.id },
      });

      summary.migrated++;
      summary.logs.push({
        email,
        status: "migrated",
        detail: `Created Supabase user ${data.user.id}.`,
      });
    } catch (error) {
      summary.failed++;
      summary.logs.push({
        email,
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown migration error.",
      });
    }
  }

  return summary;
}
