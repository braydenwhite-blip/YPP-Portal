"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ModalV2 } from "@/components/ui-v2";
import type {
  StudentClassHistoryItem,
  StudentFamilyMember,
} from "@/lib/classes/student-class-history";

export type ClassPeopleRow = {
  id: string;
  studentId: string;
  status: string;
  name: string;
  email: string | null;
  roleLabel: string;
  classes: StudentClassHistoryItem[];
  family: StudentFamilyMember[];
};

function sortByName(a: ClassPeopleRow, b: ClassPeopleRow) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function formatExactDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function classDateLines(item: StudentClassHistoryItem) {
  const lines: string[] = [];
  const start = formatExactDate(item.offeringStartDate);
  const end = formatExactDate(item.offeringEndDate);
  if (start && end) lines.push(`Class dates: ${start} – ${end}`);
  else if (start) lines.push(`Class starts: ${start}`);
  else if (end) lines.push(`Class ends: ${end}`);

  const enrolled = formatExactDate(item.enrolledAt);
  if (enrolled) lines.push(`Enrolled: ${enrolled}`);

  if (item.status === "COMPLETED") {
    const completed = formatExactDate(item.completedAt);
    if (completed) lines.push(`Completed: ${completed}`);
  }
  if (item.status === "DROPPED") {
    const left = formatExactDate(item.droppedAt);
    if (left) lines.push(`Left: ${left}`);
  }
  return lines;
}

export function ClassPeopleRoster({
  classId,
  classTitle,
  rows,
}: {
  classId: string;
  classTitle: string;
  rows: ClassPeopleRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const inClass = useMemo(
    () => rows.filter((r) => r.status === "ENROLLED").sort(sortByName),
    [rows],
  );
  const wasInClass = useMemo(
    () =>
      rows
        .filter((r) => r.status === "DROPPED" || r.status === "COMPLETED")
        .sort(sortByName),
    [rows],
  );

  const openRow = openId ? rows.find((r) => r.studentId === openId) ?? null : null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8">
          <Link
            href={`/instructor/classes/${classId}`}
            className="text-[13px] font-medium text-[#5f6368] no-underline hover:text-[#202124] hover:underline"
          >
            ← {classTitle}
          </Link>
          <h1 className="m-0 mt-3 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
            People
          </h1>
          <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
            Who is in this class, and who was in it before. Tap someone to see their
            classes across YPP.
          </p>
        </header>

        <PeopleSection
          title="In this class"
          count={inClass.length}
          empty="No students enrolled yet."
          rows={inClass}
          onOpen={setOpenId}
        />
        <PeopleSection
          title="Was in this class"
          count={wasInClass.length}
          empty="No former students."
          rows={wasInClass}
          className="mt-8"
          muted
          statusLabel={(row) =>
            row.status === "COMPLETED" ? "Completed" : "Left class"
          }
          onOpen={setOpenId}
        />
      </div>

      <ModalV2
        open={Boolean(openRow)}
        onClose={() => setOpenId(null)}
        labelledBy="student-profile-title"
        size="md"
      >
        {openRow ? (
          <StudentProfilePanel
            row={openRow}
            currentClassId={classId}
            onClose={() => setOpenId(null)}
          />
        ) : null}
      </ModalV2>
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
  onOpen,
}: {
  title: string;
  count: number;
  empty: string;
  rows: ClassPeopleRow[];
  className?: string;
  muted?: boolean;
  statusLabel?: (row: ClassPeopleRow) => string;
  onOpen: (studentId: string) => void;
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
            <li key={row.id} id={`student-${row.studentId}`} className="scroll-mt-4">
              <button
                type="button"
                onClick={() => onOpen(row.studentId)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#f8f9fa]"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[13px] font-semibold text-[#174ea6]"
                >
                  {row.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14.5px] font-medium text-[#202124]">
                    {row.name}
                  </p>
                  <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#5f6368]">
                    {row.roleLabel}
                    {row.classes.length > 0
                      ? ` · ${row.classes.length} class${row.classes.length === 1 ? "" : "es"}`
                      : ""}
                  </p>
                </div>
                {statusLabel ? (
                  <span className="shrink-0 rounded-full bg-[#f1f3f4] px-2.5 py-1 text-[11.5px] font-medium text-[#5f6368]">
                    {statusLabel(row)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] font-medium text-[#1967d2]">
                    View
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StudentProfilePanel({
  row,
  currentClassId,
  onClose,
}: {
  row: ClassPeopleRow;
  currentClassId: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[16px] font-semibold text-[#174ea6]"
          >
            {row.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h2
              id="student-profile-title"
              className="m-0 truncate text-[20px] font-medium tracking-[-0.02em] text-[#202124]"
            >
              {row.name}
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-[#5f6368]">
              {row.roleLabel}
              {row.email ? ` · ${row.email}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-2 py-1 text-[13px] font-medium text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
        >
          Close
        </button>
      </div>

      <div>
        <h3 className="m-0 text-[13px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
          Family
        </h3>
        {row.family.length === 0 ? (
          <p className="m-0 mt-3 rounded-xl border border-dashed border-[#dadce0] px-4 py-5 text-[13.5px] text-[#5f6368]">
            No linked family members yet.
          </p>
        ) : (
          <ul className="m-0 mt-3 list-none divide-y divide-[#f1f3f4] overflow-hidden rounded-xl border border-[#dadce0] p-0">
            {row.family.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                    member.kind === "sibling"
                      ? "bg-[#e8f0fe] text-[#174ea6]"
                      : "bg-[#fce8e6] text-[#c5221f]",
                  ].join(" ")}
                >
                  {member.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14px] font-medium text-[#202124]">
                    {member.name}
                  </p>
                  <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#5f6368]">
                    {member.relationship}
                    {member.email ? ` · ${member.email}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="m-0 text-[13px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
          Classes at YPP
        </h3>
        {row.classes.length === 0 ? (
          <p className="m-0 mt-3 rounded-xl border border-dashed border-[#dadce0] px-4 py-5 text-[13.5px] text-[#5f6368]">
            No other class history yet.
          </p>
        ) : (
          <ul className="m-0 mt-3 list-none divide-y divide-[#f1f3f4] overflow-hidden rounded-xl border border-[#dadce0] p-0">
            {row.classes.map((item) => {
              const meta = [
                item.instructorName ? `with ${item.instructorName}` : null,
                item.semester,
                item.partnerName,
                item.chapterName,
              ]
                .filter(Boolean)
                .join(" · ");
              const dateLines = classDateLines(item);
              const isCurrent = item.offeringId === currentClassId;
              return (
                <li key={item.enrollmentId} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="m-0 text-[14px] font-medium text-[#202124]">
                      {item.title}
                      {isCurrent ? (
                        <span className="ml-2 text-[11.5px] font-medium text-[#1967d2]">
                          This class
                        </span>
                      ) : null}
                    </p>
                    <span className="text-[11.5px] font-medium text-[#5f6368]">
                      {item.statusLabel}
                    </span>
                  </div>
                  {meta ? (
                    <p className="m-0 mt-1 text-[12.5px] leading-5 text-[#5f6368]">
                      {meta}
                    </p>
                  ) : null}
                  {dateLines.length > 0 ? (
                    <ul className="m-0 mt-1.5 list-none space-y-0.5 p-0 text-[12.5px] leading-5 text-[#3c4043]">
                      {dateLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
