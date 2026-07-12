import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { formatReportingPeriod } from "@/lib/chapters/operations-model";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Filters = { chapter?: string; type?: string; status?: string };

export default async function AdminChapterReportsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) redirect("/");
  const filters = await searchParams;
  const type = filters.type === "WEEKLY" || filters.type === "MONTHLY" ? filters.type : undefined;
  const status = filters.status === "DRAFT" || filters.status === "FINALIZED" ? filters.status : undefined;
  const [chapters, reports] = await Promise.all([
    prisma.chapter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.chapterOperationsReport.findMany({
      where: { chapterId: filters.chapter || undefined, type, status },
      include: { chapter: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: [{ periodStart: "desc" }, { chapter: { name: "asc" } }],
      take: 500,
    }),
  ]);
  const finalized = reports.filter((report) => report.status === "FINALIZED").length;
  const weekly = reports.filter((report) => report.type === "WEEKLY").length;
  const monthly = reports.filter((report) => report.type === "MONTHLY").length;

  return <main className="mx-auto w-full max-w-7xl px-6 py-8">
    <PageHeaderV2 eyebrow="Global leadership" title="Chapter reporting" subtitle="Saved, deterministic weekly and monthly snapshots across chapters—without an invented health score." />
    <section className="mt-7 grid border-y border-slate-200 sm:grid-cols-4">
      {[["Reports shown", reports.length], ["Finalized", finalized], ["Weekly", weekly], ["Monthly", monthly]].map(([label, value]) => <div key={label} className="px-4 py-3 sm:border-r sm:last:border-r-0"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</p></div>)}
    </section>
    <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
      <label className="text-sm font-medium text-slate-700">Chapter<select name="chapter" defaultValue={filters.chapter ?? ""} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">All chapters</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Report type<select name="type" defaultValue={type ?? ""} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Weekly and monthly</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
      <label className="text-sm font-medium text-slate-700">Status<select name="status" defaultValue={status ?? ""} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Draft and finalized</option><option value="FINALIZED">Finalized</option><option value="DRAFT">Draft</option></select></label>
      <button className="button" type="submit">Apply filters</button>
      <Link href="/admin/chapter-reports" className="pb-2 text-sm font-medium text-brand-700">Clear</Link>
    </form>
    <section className="mt-6"><h2 className="text-base font-semibold text-slate-950">Reporting history</h2><p className="mt-1 text-sm text-slate-600">Each row is a historical snapshot. Open one to inspect its metrics, narratives, and exact source records.</p>
      {reports.length ? <div className="mt-4 overflow-x-auto"><table className="w-full border-y border-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Chapter</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Saved by</th><th className="px-3 py-2">Updated</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id} className="border-t border-slate-100"><td className="px-3 py-2 font-medium text-slate-950">{report.chapter.name}</td><td className="whitespace-nowrap px-3 py-2"><Link href={`/admin/chapter-reports/${report.id}`} className="font-medium text-brand-700">{formatReportingPeriod(report.periodStart, report.periodEnd)}</Link></td><td className="px-3 py-2">{report.type === "WEEKLY" ? "Weekly" : "Monthly"}</td><td className="px-3 py-2">{report.status === "FINALIZED" ? "Finalized" : "Draft"}</td><td className="px-3 py-2 text-slate-600">{report.createdBy.name}</td><td className="whitespace-nowrap px-3 py-2 text-slate-600">{report.updatedAt.toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 border-y border-slate-200 py-6 text-sm text-slate-600">No reports match these filters. A report appears after chapter leadership saves its weekly review or monthly report.</p>}
    </section>
  </main>;
}
