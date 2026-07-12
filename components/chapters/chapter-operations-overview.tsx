import Link from "next/link";

import { ChapterOperationsCharts } from "@/components/chapters/chapter-operations-charts";
import type { loadChapterOperations } from "@/lib/chapters/operations";
import { attainmentPercent } from "@/lib/chapters/operations-model";

type Data = NonNullable<Awaited<ReturnType<typeof loadChapterOperations>>>;

function dateTime(value: Date) { return value.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

export function ChapterOperationsOverview({ data }: { data: Data }) {
  const a = data.weeklyActivity;
  const activity = [
    ["New students", a.newStudents, "/chapter?lane=students"], ["Sessions held", a.sessionsHeld, "/chapter?lane=instructors"],
    ["Attendance rate", `${a.attendanceRate}%`, "/chapter?lane=students"], ["Outreach attempts", a.outreachAttempts, "/chapter?lane=partners"],
    ["Partner meetings", a.partnerMeetings, "/chapter?lane=meetings"], ["Open tasks", a.openTasks, "/chapter?lane=actions"],
    ["Overdue tasks", a.overdueTasks, "/chapter?lane=actions"], ["Follow-ups due", a.followUpsDue, "/chapter?lane=actions"],
    ["Meetings next 7 days", a.meetingsNextSevenDays, "/chapter?lane=meetings"], ["Meeting follow-ups due", a.meetingFollowUpsDue, "/chapter?lane=meetings"],
  ] as const;

  return (
    <div className="space-y-7">
      <section aria-labelledby="key-metrics">
        <div className="mb-3 flex items-end justify-between gap-4"><div><h2 id="key-metrics" className="text-base font-semibold text-slate-950">Key metrics</h2><p className="text-sm text-slate-600">Actuals from live chapter records; targets are chapter-controlled.</p></div><Link href="/chapter/settings#operations-targets" className="text-sm font-medium text-brand-700">Edit targets</Link></div>
        <div className="grid border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          {data.metrics.map((m) => <Link key={m.key} href={m.href} className="group px-4 py-4 no-underline hover:bg-slate-50 lg:border-r lg:border-slate-200 lg:last:border-r-0"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">{m.value}</p><p className="mt-1 text-xs text-slate-600">Target {m.target} · {m.value - m.target >= 0 ? "+" : ""}{m.value - m.target} · {attainmentPercent(m.value, m.target)}%</p></Link>)}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">Needs attention now</h2><p className="text-sm text-slate-600">Specific records to resolve or discuss in the next weekly review.</p></div><Link href="/chapter?lane=actions" className="text-sm font-medium text-brand-700">Open actions</Link></div>{data.discussionItems.length ? <div className="divide-y divide-slate-100 border-y border-slate-200">{data.discussionItems.map((item) => <Link key={item.id} href={item.href} className="grid gap-1 px-3 py-3 no-underline hover:bg-slate-50 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-medium text-slate-950">{item.label}</p><p className="text-xs text-slate-600">{item.why}</p></div><p className="text-xs text-slate-600 sm:text-right">{item.owner}<br />{item.dueISO ? `Due ${new Date(item.dueISO).toLocaleDateString()}` : "No due date set"}</p></Link>)}</div> : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">No overdue, blocked, support, or session follow-up records require attention.</p>}</section>
        <section><h2 className="mb-3 text-base font-semibold text-slate-950">Recent changes</h2>{data.model.recentActivity.length ? <div className="divide-y divide-slate-100 border-y border-slate-200">{data.model.recentActivity.slice(0, 6).map((item) => <Link key={item.id} href={item.href} className="block px-3 py-3 no-underline hover:bg-slate-50"><p className="text-sm font-medium text-slate-950">{item.title}</p><p className="text-xs text-slate-600">{item.description ?? "Record updated"} · {item.occurredAt.toLocaleDateString()}</p></Link>)}</div> : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">No recent chapter record changes.</p>}</section>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <section><h2 className="mb-3 text-base font-semibold text-slate-950">Weekly activity</h2><div className="grid grid-cols-2 border-y border-slate-200 sm:grid-cols-4">{activity.map(([label, value, href]) => <Link key={label} href={href} className="border-b border-r border-slate-200 p-3 no-underline hover:bg-slate-50"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{value}</p></Link>)}</div></section>
        <section><h2 className="mb-3 text-base font-semibold text-slate-950">Next meeting</h2>{data.nextMeeting ? <Link href={`/meetings/${data.nextMeeting.id}`} className="block border-y border-slate-200 py-3 no-underline hover:bg-slate-50"><p className="font-semibold text-slate-950">{data.nextMeeting.title}</p><p className="mt-1 text-sm text-slate-600">{dateTime(data.nextMeeting.scheduledAt)} · {data.nextMeeting.type.replaceAll("_", " ")}</p>{data.nextMeeting.purpose ? <p className="mt-2 text-sm text-slate-700">{data.nextMeeting.purpose}</p> : null}<p className="mt-2 text-xs text-slate-600">Related: {data.nextMeeting.relatedLabel ?? "Chapter operations"}</p><p className="mt-1 text-xs text-slate-600">Owner: {data.nextMeeting.facilitator?.name ?? "Unassigned"} · {data.nextMeeting.preparationStatus}</p></Link> : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">No upcoming meeting is scheduled.</p>}</section>
      </div>

      <section><h2 className="mb-3 text-base font-semibold text-slate-950">Upcoming deadlines</h2>{data.deadlines.length ? <div className="overflow-x-auto"><table className="w-full border-y border-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Due</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{data.deadlines.map((d) => <tr key={`${d.type}-${d.id}`} className="border-t border-slate-100"><td className="whitespace-nowrap px-3 py-2">{new Date(d.dueAtISO).toLocaleDateString()}</td><td className="px-3 py-2"><Link href={d.href} className="font-medium text-brand-700">{d.label}</Link></td><td className="px-3 py-2 text-slate-600">{d.type}</td><td className="px-3 py-2 text-slate-600">{d.owner}</td><td className="px-3 py-2 text-slate-600">{d.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div> : <p className="border-y border-slate-200 py-6 text-sm text-slate-600">No dated tasks or follow-ups are due.</p>}</section>

      <ChapterOperationsCharts metrics={data.metrics} trend={data.activityTrend} attendance={data.attendanceDistribution} />

      <section><div className="mb-3 flex items-end justify-between"><h2 className="text-base font-semibold text-slate-950">Operating scorecard</h2><Link href="/chapter/reports" className="text-sm font-medium text-brand-700">Open reports</Link></div><table className="w-full border-y border-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Area</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2 text-right">Attainment</th></tr></thead><tbody>{data.metrics.map((m) => <tr key={m.key} className="border-t border-slate-100"><td className="px-3 py-2"><Link href={m.href} className="font-medium text-brand-700">{m.label}</Link></td><td className="px-3 py-2 text-right tabular-nums">{m.value}</td><td className="px-3 py-2 text-right tabular-nums">{m.target}</td><td className="px-3 py-2 text-right tabular-nums">{m.value - m.target}</td><td className="px-3 py-2 text-right tabular-nums">{attainmentPercent(m.value, m.target)}%</td></tr>)}</tbody></table></section>
    </div>
  );
}
