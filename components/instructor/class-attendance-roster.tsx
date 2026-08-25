import Link from "next/link";

import { EmptyStateV2 } from "@/components/ui-v2";

type RosterData = {
  id: string;
  title: string;
  sessions: { id: string; sessionNumber: number; date: Date | string; topic: string }[];
  students: { id: string; name: string | null; email: string | null }[];
  statusByStudentAndSession: Record<string, Record<string, string | null>>;
  stats: Record<string, { present: number; absent: number; late: number; excused: number }>;
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "E",
};

const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-[#e6f4ea] text-[#0d652d]",
  ABSENT: "bg-[#fce8e6] text-[#a50e0e]",
  LATE: "bg-[#fef7e0] text-[#b06000]",
  EXCUSED: "bg-[#e8f0fe] text-[#1a56db]",
};

function shortDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
}

export function ClassAttendanceRoster({ roster }: { roster: RosterData }) {
  const hasSessions = roster.sessions.length > 0;
  const hasStudents = roster.students.length > 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="m-0 text-[13px] font-medium text-[#5f6368]">{roster.title}</p>
            <h1 className="m-0 mt-1 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              Attendance
            </h1>
            <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
              Finalized attendance across every session for this class.
            </p>
          </div>
          <Link
            href={`/instructor/classes/${roster.id}`}
            className="shrink-0 text-[13.5px] font-medium text-brand-700 no-underline hover:underline"
          >
            Back to class
          </Link>
        </header>

        {!hasStudents ? (
          <EmptyStateV2 title="No students yet" body="Attendance will show here once students are enrolled." />
        ) : !hasSessions ? (
          <EmptyStateV2 title="No sessions yet" body="Attendance will show here once sessions are scheduled." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#dadce0] bg-white">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#dadce0] bg-[#f8f9fa]">
                  <th className="sticky left-0 z-10 bg-[#f8f9fa] px-4 py-3 font-medium text-[#5f6368]">
                    Student
                  </th>
                  {roster.sessions.map((s) => (
                    <th key={s.id} className="min-w-[64px] px-2 py-3 text-center font-medium text-[#5f6368]">
                      <div>{shortDate(s.date)}</div>
                      <div className="text-[11px] font-normal text-[#80868b]">Class {s.sessionNumber}</div>
                    </th>
                  ))}
                  <th className="min-w-[180px] px-4 py-3 text-center font-medium text-[#5f6368]">Totals</th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((student) => {
                  const row = roster.statusByStudentAndSession[student.id] ?? {};
                  const stat = roster.stats[student.id] ?? { present: 0, absent: 0, late: 0, excused: 0 };
                  return (
                    <tr key={student.id} className="border-b border-[#f1f3f4] last:border-b-0">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <div className="font-medium text-[#202124]">{student.name || "Student"}</div>
                        {student.email ? (
                          <div className="text-[11.5px] text-[#80868b]">{student.email}</div>
                        ) : null}
                      </td>
                      {roster.sessions.map((s) => {
                        const status = row[s.id];
                        return (
                          <td key={s.id} className="px-2 py-3 text-center">
                            {status ? (
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${STATUS_STYLE[status] ?? "bg-[#f1f3f4] text-[#5f6368]"}`}
                                title={status}
                              >
                                {STATUS_LABEL[status] ?? "?"}
                              </span>
                            ) : (
                              <span className="text-[#dadce0]">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center text-[12.5px] text-[#3c4043]">
                        {stat.present}P · {stat.absent}A · {stat.late}L · {stat.excused}E
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}