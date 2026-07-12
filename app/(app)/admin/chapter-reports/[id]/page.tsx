import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { formatReportingPeriod } from "@/lib/chapters/operations-model";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminChapterReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) redirect("/");
  const { id } = await params;
  const report = await prisma.chapterOperationsReport.findUnique({ where: { id }, include: { chapter: { select: { name: true } }, createdBy: { select: { name: true } } } });
  if (!report) notFound();
  const metrics = report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics) ? Object.entries(report.metrics as Record<string, unknown>) : [];
  const sourceEnvelope = report.sourceRecordRefs && typeof report.sourceRecordRefs === "object" && !Array.isArray(report.sourceRecordRefs) ? report.sourceRecordRefs as Record<string, unknown> : {};
  const metricRecords = sourceEnvelope.metricRecords && typeof sourceEnvelope.metricRecords === "object" && !Array.isArray(sourceEnvelope.metricRecords) ? sourceEnvelope.metricRecords as Record<string, unknown> : {};
  const narratives = [["Biggest win", report.biggestWin], ["Biggest challenge / risk", report.biggestChallenge], ["Main focus", report.mainFocus], ["Decision needed", report.decisionNeeded], ["Support needed", report.supportNeeded], ["Next period focus", report.nextPeriodFocus]];

  return <main className="mx-auto w-full max-w-5xl px-6 py-8"><PageHeaderV2 eyebrow={`${report.chapter.name} · ${report.type} · ${report.status}`} title={formatReportingPeriod(report.periodStart, report.periodEnd)} subtitle={`Snapshot saved by ${report.createdBy.name} on ${report.updatedAt.toLocaleString()}.`} actions={<ButtonLink href="/admin/chapter-reports" variant="secondary" size="sm">All chapter reports</ButtonLink>} />
    <section className="mt-8"><h2 className="text-base font-semibold">Saved metrics</h2><div className="mt-3 overflow-x-auto"><table className="w-full border-y border-slate-200 text-sm"><tbody>{metrics.map(([key, value]) => <tr key={key} className="border-t border-slate-100"><th className="px-3 py-2 text-left font-medium text-slate-700">{label(key)}</th><td className="px-3 py-2 text-right tabular-nums">{String(value)}</td></tr>)}</tbody></table></div></section>
    <section className="mt-8"><h2 className="text-base font-semibold">Source records</h2><p className="mt-1 text-sm text-slate-600">The exact records captured when this snapshot was saved.</p><div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">{Object.entries(metricRecords).map(([key, raw]) => { const refs = refsFrom(raw); return <details key={key} className="px-3 py-2 text-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span className="font-medium text-slate-700">{label(key)}</span><span className="text-slate-600">{refs.length} record{refs.length === 1 ? "" : "s"}{refs.length ? " · View" : ""}</span></summary>{refs.length ? <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-l border-slate-200 pl-3">{refs.map((ref, index) => <div key={`${ref.id}-${index}`}><Link href={ref.href} className="font-medium text-brand-700">Open record {index + 1}</Link><span className="ml-2 font-mono text-xs text-slate-500">{ref.id}</span></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No source records contributed to this metric.</p>}</details>; })}</div></section>
    <section className="mt-8 space-y-5">{narratives.filter(([, value]) => value).map(([name, value]) => <div key={name}><h3 className="text-sm font-semibold text-slate-700">{name}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value}</p></div>)}</section>
  </main>;
}

function label(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()); }
function refsFrom(raw: unknown) { return Array.isArray(raw) ? raw.filter((item): item is { id: string; href: string } => Boolean(item && typeof item === "object" && "id" in item && "href" in item)) : []; }
