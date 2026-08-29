import { redirect } from "next/navigation";

import {
  calendarMonthKey,
  calendarMonthLabel,
  ChapterMonthNav,
  lifecycleMonthFromCalendar,
  parseCalendarMonth,
} from "@/components/chapter/metrics-tracker/chapter-month-nav";
import { MetricsHubView } from "@/components/chapter/metrics-tracker/metrics-tracker-ui";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization-roles";
import { loadMetricsHub } from "@/lib/chapters/metrics-tracker/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metrics — Pathways Portal" };

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
  const calendarMonth = parseCalendarMonth(sp.month);
  const chapterMonth = lifecycleMonthFromCalendar(calendarMonth);
  const monthKey = calendarMonthKey(calendarMonth);

  // Deep links used to open a separate category page; keep everything on the hub.
  if (sp.scope || sp.category) {
    redirect(`/admin/metrics?month=${monthKey}`);
  }

  const hub = await loadMetricsHub({ chapterMonth });

  return (
    <div className="relative min-h-full bg-surface-soft/40">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-7 sm:px-8 lg:px-10">
        <PageHeaderV2
          eyebrow="Admin"
          title="Metrics"
          subtitle="Full org, chapter, and instructor trackers. Admins can edit any metric, owner, and M1–M6 target."
          actions={<ChapterMonthNav month={calendarMonth} />}
        />

        <MetricsHubView
          scopes={hub.scopes}
          chapterMonth={chapterMonth}
          monthLabel={calendarMonthLabel(calendarMonth)}
          canEdit
        />
      </div>
    </div>
  );
}
