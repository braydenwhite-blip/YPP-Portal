import { PageHeaderV2 } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { WeeklyImpactForm } from "@/components/weekly-meetings/weekly-impact-form";
import { WeekNavigator } from "@/components/weekly-meetings/week-navigator";
import { requireImpactAuthor } from "@/lib/weekly-meetings/permissions";
import { loadMyWeeklyImpact } from "@/lib/weekly-meetings/weekly-impact";
import { loadWeeklyContributions } from "@/lib/weekly-meetings/contributions";
import { addWeeks, parseWeekKey, weekKey, weekStartFor } from "@/lib/weekly-meetings/week";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function MyWeeklyImpactPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireImpactAuthor();
  const params = (await searchParams) ?? {};
  const weekStart = parseWeekKey(firstParam(params.week)) ?? weekStartFor();

  const [data, user, contributions] = await Promise.all([
    loadMyWeeklyImpact(viewer, weekStart),
    prisma.user.findUnique({ where: { id: viewer.id }, select: { name: true } }),
    loadWeeklyContributions(viewer.id, weekStart),
  ]);

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <div className="mx-auto flex max-w-[960px] flex-col gap-6 pb-16 pt-4">
        <PageHeaderV2
          eyebrow="Weekly Meetings"
          title="My Weekly Impact"
          subtitle={`${data.weekLabel} — log what you did, flag what to present, and note what you need.`}
        />

        <WeekNavigator
          weekKey={data.weekKey}
          weekLabel={data.weekLabel}
          prevKey={weekKey(addWeeks(weekStart, -1))}
          nextKey={weekKey(addWeeks(weekStart, 1))}
          currentKey={weekKey(weekStartFor())}
          weekState={data.weekState}
        />

        <WeeklyImpactForm data={data} userName={user?.name ?? "You"} contributions={contributions} />
      </div>
    </div>
  );
}
