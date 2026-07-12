"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "#64748b" };

export function ChapterOperationsCharts({ metrics, trend, attendance }: {
  metrics: { label: string; value: number; target: number }[];
  trend: { week: string; outreach: number; sessions: number; tasksCreated: number; tasksCompleted: number }[];
  attendance: { range: string; sessions: number }[];
}) {
  const scorecardData = metrics.map((metric) => ({ ...metric, shortLabel: metric.key === "pipeline" ? "Pipeline" : metric.label.replace(/^Active /, "").replace(" running", "") }));
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartFrame title="Current versus target">
        <BarChart data={scorecardData} margin={{ left: -12, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="shortLabel" tick={AXIS} interval={0} height={36} />
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

export function ChapterTaskTrendChart({ data }: { data: { week: string; tasksCreated: number; tasksCompleted: number }[] }) {
  return <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: -22, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="week" tick={AXIS} /><YAxis tick={AXIS} allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="tasksCreated" name="Created" stroke="#64748b" strokeWidth={2} /><Line type="monotone" dataKey="tasksCompleted" name="Completed" stroke="#0f766e" strokeWidth={2} /></LineChart></ResponsiveContainer></div>;
}

export function ChapterClassCharts({ data }: { data: { name: string; capacity: number; enrolled: number; attendance: number }[] }) {
  return <div className="grid gap-5 lg:grid-cols-2"><ChartFrame title="Enrollment versus capacity"><BarChart data={data} margin={{ left: -22, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={AXIS} /><YAxis tick={AXIS} allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="enrolled" name="Enrolled" fill="#0f4c81" /><Bar dataKey="capacity" name="Capacity" fill="#94a3b8" /></BarChart></ChartFrame><ChartFrame title="Attendance by class"><BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={AXIS} /><YAxis tick={AXIS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="attendance" name="Average attendance" fill="#0f766e" /></BarChart></ChartFrame></div>;
}

export function ChapterMonthlyTrendChart({ data }: { data: { month: string; students: number; instructors: number; partners: number; classes: number }[] }) {
  return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: -22, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tick={AXIS} /><YAxis tick={AXIS} allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="students" name="New students" stroke="#0f4c81" strokeWidth={2} /><Line type="monotone" dataKey="instructors" name="New instructors" stroke="#7c3aed" strokeWidth={2} /><Line type="monotone" dataKey="partners" name="New partners" stroke="#0f766e" strokeWidth={2} /><Line type="monotone" dataKey="classes" name="New classes" stroke="#d97706" strokeWidth={2} /></LineChart></ResponsiveContainer></div>;
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t border-slate-200 pt-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
    </section>
  );
}
