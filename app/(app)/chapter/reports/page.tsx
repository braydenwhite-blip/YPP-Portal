import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeaderV2, ButtonLink } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { loadChapterOperations } from "@/lib/chapters/operations";
import { saveChapterOperationsReport } from "@/lib/chapters/operations-actions";
import { ChapterMonthlyTrendChart } from "@/components/chapters/chapter-operations-charts";
import { formatReportingPeriod } from "@/lib/chapters/operations-model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Reports — Pathways Portal" };

export default async function ChapterReportsPage() {
  const ctx = await getChapterViewerContext();
  if (!ctx.ledChapterId) redirect(ctx.isLeadership ? "/admin/chapter-reports" : "/chapter");
  const data = await loadChapterOperations(ctx.ledChapterId);
  if (!data) redirect("/chapter");
  const weeklyExisting = data.reportHistory.find((report) => report.type === "WEEKLY" && report.periodStart.getTime() === data.periods.weekly.start.getTime());
  const monthlyExisting = data.reportHistory.find((report) => report.type === "MONTHLY" && report.periodStart.getTime() === data.periods.monthly.start.getTime());
  return <main className="mx-auto w-full max-w-6xl px-6 py-8"><PageHeaderV2 eyebrow="Chapter Operations" title="Reports" subtitle="Save explainable weekly and monthly snapshots from live chapter records." actions={<ButtonLink href="/chapter" variant="secondary" size="sm">Back to overview</ButtonLink>} />
    <div className="mt-7 grid gap-8 lg:grid-cols-2"><ReportForm chapterId={ctx.ledChapterId} type="WEEKLY" period={formatReportingPeriod(data.periods.weekly.start, data.periods.weekly.end)} metrics={data.weeklyActivity} existing={weeklyExisting} /><ReportForm chapterId={ctx.ledChapterId} type="MONTHLY" period={formatReportingPeriod(data.periods.monthly.start, data.periods.monthly.end)} metrics={data.monthlyActivity} existing={monthlyExisting} /></div>
    <section className="mt-10 border-t border-slate-200 pt-4"><h2 className="text-base font-semibold text-slate-950">Twelve-month growth trend</h2><p className="mb-3 mt-1 text-sm text-slate-600">New records by month, calculated from their original portal timestamps.</p><ChapterMonthlyTrendChart data={data.monthlyTrend} /></section>
    <section className="mt-10"><h2 className="text-base font-semibold text-slate-950">Reporting history</h2><p className="mt-1 text-sm text-slate-600">Saved values stay fixed even when live records change.</p>{data.reportHistory.length ? <div className="mt-4 overflow-x-auto"><table className="w-full border-y border-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Saved</th></tr></thead><tbody>{data.reportHistory.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="px-3 py-2"><Link className="font-medium text-brand-700" href={`/chapter/reports/${r.id}`}>{formatReportingPeriod(r.periodStart, r.periodEnd)}</Link></td><td className="px-3 py-2">{r.type}</td><td className="px-3 py-2">{r.status}</td><td className="px-3 py-2">{r.updatedAt.toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 border-y border-slate-200 py-6 text-sm text-slate-600">No reports have been saved yet.</p>}</section>
  </main>;
}

type ExistingReport = { id: string; status: string; biggestWin: string | null; biggestChallenge: string | null; mainFocus: string | null; decisionNeeded: string | null; supportNeeded: string | null; nextPeriodFocus: string | null };

function ReportForm({ chapterId, type, period, metrics, existing }: { chapterId: string; type: "WEEKLY" | "MONTHLY"; period: string; metrics: Record<string, number>; existing?: ExistingReport }) {
  const monthly = type === "MONTHLY";
  const fields = monthly ? [["biggestWin", "Key win"], ["biggestChallenge", "Key risk"], ["supportNeeded", "Request or support needed"]] : [["biggestWin", "Biggest win"], ["biggestChallenge", "Biggest challenge"], ["mainFocus", "Main focus"], ["decisionNeeded", "Decision needed"], ["supportNeeded", "Support needed"], ["nextPeriodFocus", "Next week’s focus"]];
  const defaults: Record<string, string | null | undefined> = existing ?? {};
  return <section className="border-t-2 border-slate-900 pt-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">{monthly ? "Monthly report" : "Weekly review"}</h2><p className="mt-0.5 text-sm text-slate-600">{period}</p></div>{existing && <Link href={`/chapter/reports/${existing.id}`} className="text-sm font-medium text-brand-700">Open saved {existing.status.toLowerCase()}</Link>}</div><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 border-y border-slate-200 py-3 text-sm">{Object.entries(metrics).slice(0, monthly ? 12 : 14).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span className="text-slate-600">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span><strong className="tabular-nums">{key.toLowerCase().includes("rate") ? `${value}%` : value}</strong></div>)}</div>{existing?.status === "FINALIZED" ? <p className="mt-4 text-sm text-slate-600">This period is finalized and cannot be changed. Live data continues updating separately.</p> : <form action={saveChapterOperationsReport} className="mt-4 space-y-3"><input type="hidden" name="chapterId" value={chapterId} /><input type="hidden" name="type" value={type} />{fields.map(([name, label]) => <label key={name} className="block text-sm font-medium text-slate-700">{label}<textarea name={name} rows={2} maxLength={10000} defaultValue={defaults[name] ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>)}<div className="flex gap-2"><button className="button" name="intent" value="draft">Save draft</button><button className="button secondary" name="intent" value="finalize">Finalize snapshot</button></div></form>}</section>;
}
