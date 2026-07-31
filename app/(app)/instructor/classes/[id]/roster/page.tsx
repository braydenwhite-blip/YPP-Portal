import Link from "next/link";
import { notFound } from "next/navigation";

import { getInstructorClass } from "@/lib/session8/instructor-ops";

export const dynamic = "force-dynamic";
export const metadata = { title: "People — YPP" };

type EnrollmentRow = {
  id: string;
  status: string;
  studentId: string;
  enrolledAt?: string | Date | null;
  droppedAt?: string | Date | null;
  completedAt?: string | Date | null;
  student?: {
    id: string;
    name?: string | null;
    email?: string | null;
    profile?: { grade?: number | null; gradeLevel?: string | null } | null;
  } | null;
};

function sortByName(a: EnrollmentRow, b: EnrollmentRow) {
  return (a.student?.name ?? "").localeCompare(b.student?.name ?? "", undefined, {
    sensitivity: "base",
  });
}

function gradeLabel(entry: EnrollmentRow) {
  const grade = entry.student?.profile?.grade;
  if (grade != null) return `Grade ${grade}`;
  const level = entry.student?.profile?.gradeLevel;
  if (level) return level;
  return "Grade not set";
}

export default async function InstructorClassRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getInstructorClass(id);
  if (!c) notFound();

  const enrollments = ((c as { enrollments?: EnrollmentRow[] }).enrollments ?? []) as EnrollmentRow[];
  const inClass = enrollments.filter((e) => e.status === "ENROLLED").sort(sortByName);
  const waitlisted = enrollments.filter((e) => e.status === "WAITLISTED").sort(sortByName);
  const former = enrollments
    .filter((e) => e.status === "DROPPED" || e.status === "COMPLETED")
    .sort(sortByName);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8">
          <Link
            href={`/instructor/classes/${id}`}
            className="text-[13px] font-medium text-[#5f6368] no-underline hover:text-[#202124] hover:underline"
          >
            ← {c.title}
          </Link>
          <h1 className="m-0 mt-3 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
            People
          </h1>
          <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
            Who is in this class now, who is waitlisted, and who was in it before.
          </p>
        </header>

        <PeopleSection
          title="In this class"
          count={inClass.length}
          empty="No enrolled students yet."
          rows={inClass}
        />
        <PeopleSection
          title="Waitlisted"
          count={waitlisted.length}
          empty="No one on the waitlist."
          rows={waitlisted}
          className="mt-8"
        />
        <PeopleSection
          title="Was in this class"
          count={former.length}
          empty="No former students."
          rows={former}
          className="mt-8"
          muted
          statusLabel={(row) =>
            row.status === "COMPLETED" ? "Completed" : "Dropped"
          }
        />
      </div>
    </main>
  );
}

function PeopleSection({
  title,
  count,
  empty,
  rows,
  className,
  muted = false,
  statusLabel,
}: {
  title: string;
  count: number;
  empty: string;
  rows: EnrollmentRow[];
  className?: string;
  muted?: boolean;
  statusLabel?: (row: EnrollmentRow) => string;
}) {
  return (
    <section className={className} aria-label={title}>
      <h2 className="m-0 mb-3 text-[14px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
        {title} ({count})
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 rounded-2xl border border-[#dadce0] bg-white px-4 py-5 text-[14px] text-[#5f6368]">
          {empty}
        </p>
      ) : (
        <ul
          className={[
            "m-0 list-none divide-y divide-[#f1f3f4] overflow-hidden rounded-2xl border border-[#dadce0] bg-white p-0 shadow-[0_1px_2px_rgba(60,64,67,0.08)]",
            muted ? "opacity-90" : "",
          ].join(" ")}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              id={`student-${row.studentId}`}
              className="flex scroll-mt-4 items-center gap-3 px-4 py-3.5"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[13px] font-semibold text-[#174ea6]"
              >
                {(row.student?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[14.5px] font-medium text-[#202124]">
                  {row.student?.name ?? "Student"}
                </p>
                <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#5f6368]">
                  {gradeLabel(row)}
                  {row.student?.email ? ` · ${row.student.email}` : ""}
                </p>
              </div>
              {statusLabel ? (
                <span className="shrink-0 rounded-full bg-[#f1f3f4] px-2.5 py-1 text-[11.5px] font-medium text-[#5f6368]">
                  {statusLabel(row)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
