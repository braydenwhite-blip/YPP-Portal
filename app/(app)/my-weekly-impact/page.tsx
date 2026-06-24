import { PageHeaderV2 } from "@/components/ui-v2";
import { WeeklyImpactForm } from "@/components/weekly-meetings/weekly-impact-form";
import { requireImpactAuthor } from "@/lib/weekly-meetings/permissions";
import { loadMyWeeklyImpact } from "@/lib/weekly-meetings/weekly-impact";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyWeeklyImpactPage() {
  const viewer = await requireImpactAuthor();
  const [data, user] = await Promise.all([
    loadMyWeeklyImpact(viewer),
    prisma.user.findUnique({ where: { id: viewer.id }, select: { name: true } }),
  ]);

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Weekly Meetings"
        title="My Weekly Impact"
        subtitle={`${data.weekLabel} — log what you did, flag what to present, and note what you need.`}
      />
      <WeeklyImpactForm data={data} userName={user?.name ?? "You"} />
    </div>
  );
}
