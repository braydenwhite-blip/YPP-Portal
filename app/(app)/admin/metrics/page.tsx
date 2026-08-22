import Link from "next/link";
import { redirect } from "next/navigation";

import { MetricsHubView } from "@/components/chapter/metrics-tracker/metrics-tracker-ui";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization-roles";
import { loadMetricsHub } from "@/lib/chapters/metrics-tracker/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metrics — Pathways Portal" };

function parseMonth(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string; category?: string; month?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!hasRole(session.user.roles, "ADMIN", session.user.primaryRole ?? null)) {
    redirect("/");
  }

  const sp = (await searchParams) ?? {};
  const chapterMonth = parseMonth(sp.month);

  // Deep links used to open a separate category page; keep everything on the hub.
  if (sp.scope || sp.category) {
    redirect(`/admin/metrics?month=${chapterMonth}`);
  }

  const hub = await loadMetricsHub({ chapterMonth });

  return (
    <div className="relative min-h-full bg-surface-soft/40">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-7 sm:px-8 lg:px-10">
        <PageHeaderV2
          eyebrow="Admin"
          title="Metrics"
          subtitle="Full org, chapter president, and instructor trackers. Admins can edit any metric, owner, and M1–M6 target."
          actions={
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-ink-muted">Chapter month</span>
              <div className="flex gap-0.5 rounded-lg border border-line-card bg-surface p-0.5">
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <Link
                    key={m}
                    href={`/admin/metrics?month=${m}`}
                    title={`Month ${m} of the chapter lifecycle (M${m} targets)`}
                    className={
                      m === chapterMonth
                        ? "rounded-md bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white no-underline"
                        : "rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted no-underline hover:bg-surface-soft hover:text-ink"
                    }
                  >
                    Month {m}
                  </Link>
                ))}
              </div>
            </div>
          }
        />

        <MetricsHubView scopes={hub.scopes} chapterMonth={chapterMonth} canEdit />
      </div>
    </div>
  );
}
