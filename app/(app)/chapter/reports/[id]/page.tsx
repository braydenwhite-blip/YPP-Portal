import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeaderV2, ButtonLink } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ChapterReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getChapterViewerContext();
  if (!ctx.ledChapterId) redirect(ctx.isLeadership ? "/admin/chapter-reports" : "/chapter");
  const { id } = await params;
  const report = await prisma.chapterOperationsReport.findFirst({ where: { id, chapterId: ctx.ledChapterId }, include: { createdBy: { select: { name: true } } } });
  if (!report) notFound();
  const metrics = report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics) ? Object.entries(report.metrics as Record<string, unknown>) : [];
  const narratives = [["Biggest win", report.biggestWin], ["Biggest challenge / risk", report.biggestChallenge], ["Main focus", report.mainFocus], ["Decision needed", report.decisionNeeded], ["Support needed", report.supportNeeded], ["Next period focus", report.nextPeriodFocus]];
  return <main className="mx-auto w-full max-w-4xl px-6 py-8"><PageHeaderV2 eyebrow={`${report.type} · ${report.status}`} title={`${report.periodStart.toLocaleDateString()} – ${report.periodEnd.toLocaleDateString()}`} subtitle={`Snapshot saved by ${report.createdBy.name} on ${report.updatedAt.toLocaleString()}.`} actions={<ButtonLink href="/chapter/reports" variant="secondary" size="sm">Reporting history</ButtonLink>} />
    <section className="mt-8"><h2 className="text-base font-semibold">Saved metrics</h2><table className="mt-3 w-full border-y border-slate-200 text-sm"><tbody>{metrics.map(([key, value]) => <tr key={key} className="border-t border-slate-100"><th className="px-3 py-2 text-left font-medium text-slate-700">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</th><td className="px-3 py-2 text-right tabular-nums">{String(value)}</td></tr>)}</tbody></table></section>
    <section className="mt-8 space-y-5">{narratives.filter(([, value]) => value).map(([label, value]) => <div key={label}><h3 className="text-sm font-semibold text-slate-700">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value}</p></div>)}</section>
    <p className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">Underlying records remain available from the <Link href="/chapter" className="font-medium text-brand-700">live Chapter Operations overview</Link>.</p>
  </main>;
}
