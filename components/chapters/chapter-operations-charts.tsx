"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "#64748b" };

export function ChapterOperationsCharts({ metrics, trend, attendance }: {
  metrics: { label: string; value: number; target: number }[];
  trend: { week: string; outreach: number; sessions: number }[];
  attendance: { range: string; sessions: number }[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartFrame title="Current versus target">
        <BarChart data={metrics} margin={{ left: -22, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={AXIS} interval={0} angle={-15} textAnchor="end" height={62} />
          <YAxis tick={AXIS} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" name="Actual" fill="#0f4c81" radius={[3, 3, 0, 0]} />
          <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartFrame>
      <ChartFrame title="Eight-week activity">
        <LineChart data={trend} margin={{ left: -22, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="week" tick={AXIS} />
          <YAxis tick={AXIS} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="outreach" name="Outreach" stroke="#0f4c81" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ChartFrame>
      <ChartFrame title="Attendance distribution">
        <BarChart data={attendance} margin={{ left: -22, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="range" tick={AXIS} />
          <YAxis tick={AXIS} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="sessions" name="Sessions" fill="#0f766e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartFrame>
    </div>
  );
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t border-slate-200 pt-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
    </section>
  );
}
