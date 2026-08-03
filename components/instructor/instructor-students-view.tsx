"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, EmptyStateV2, cn } from "@/components/ui-v2";
import { completeInstructorStudentFollowUp } from "@/lib/classes/student-follow-up-actions";
import { submitInstructorAssignmentFeedback } from "@/lib/classes/assignment-feedback-actions";
import type {
  StudentAttentionItem,
  TeachingClass,
  TeachingStudent,
} from "@/lib/classes/instructor-workspace";

function sortStudents(a: TeachingStudent, b: TeachingStudent) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function splitRoster(roster: TeachingStudent[]) {
  const inClass = roster.filter((s) => s.status === "ENROLLED").sort(sortStudents);
  const wasInClass = roster
    .filter((s) => s.status === "DROPPED" || s.status === "COMPLETED")
    .sort(sortStudents);
  return { inClass, wasInClass };
}

export function InstructorStudentsView({
  activeClasses,
  completedClasses,
  attentionItems,
}: {
  activeClasses: TeachingClass[];
  completedClasses: TeachingClass[];
  attentionItems: StudentAttentionItem[];
}) {
  const hasAnyStudent =
    activeClasses.some((c) => c.roster.length > 0) ||
    completedClasses.some((c) => c.roster.length > 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[980px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8">
          <h1 className="m-0 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
            Students
          </h1>
          <p className="m-0 mt-1 max-w-2xl text-[14px] text-[#5f6368]">
            Everyone across your classes — who is enrolled now, who left or finished, and
            archived classes.
          </p>
        </header>

        {attentionItems.length > 0 ? (
          <section className="mb-10" aria-label="Needs attention">
            <h2 className="m-0 mb-3 text-[14px] font-medium uppercase tracking-[0.06em] text-[#b06000]">
              Needs attention ({attentionItems.length})
            </h2>
            <div className="divide-y divide-[#f1f3f4] overflow-hidden rounded-2xl border border-[#f9e4a8] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
              {attentionItems.map((item) => (
                <StudentFollowUpRow key={item.key} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {!hasAnyStudent ? (
          <EmptyStateV2
            title="No students yet"
            body="Students appear here once they enroll in a class you teach. Open a class People page to see one roster at a time."
          />
        ) : (
          <>
            {activeClasses.length > 0 ? (
              <section aria-label="Current classes" className="space-y-8">
                {activeClasses.map((teachingClass) => (
                  <ClassPeopleBlock key={teachingClass.id} teachingClass={teachingClass} />
                ))}
              </section>
            ) : null}

            {completedClasses.length > 0 ? (
              <section className="mt-12" aria-label="Archived classes">
                <h2 className="m-0 mb-5 text-[14px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
                  Archived classes ({completedClasses.length})
                </h2>
                <div className="space-y-8">
                  {completedClasses.map((teachingClass) => (
                    <ClassPeopleBlock
                      key={teachingClass.id}
                      teachingClass={teachingClass}
                      archived
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function ClassPeopleBlock({
  teachingClass,
  archived = false,
}: {
  teachingClass: TeachingClass;
  archived?: boolean;
}) {
  const { inClass, wasInClass } = splitRoster(teachingClass.roster);
  const peopleHref = `/instructor/classes/${teachingClass.id}/roster`;

  return (
    <article
      className={[
        "overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]",
        archived ? "opacity-90" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f3f4] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[17px] font-medium text-[#202124]">
            {teachingClass.title}
          </h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-[#5f6368]">
            {archived ? "Archived" : teachingClass.status.replaceAll("_", " ")}
            {" · "}
            {inClass.length} in class
            {wasInClass.length > 0 ? ` · ${wasInClass.length} former` : ""}
          </p>
        </div>
        <Link
          href={peopleHref}
          className="shrink-0 text-[13px] font-medium text-brand-700 no-underline hover:underline"
        >
          Open people →
        </Link>
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        <RosterColumn
          title="In this class"
          rows={inClass}
          empty="No enrolled students."
          classId={teachingClass.id}
        />
        <RosterColumn
          title="Was in this class"
          rows={wasInClass}
          empty="No former students."
          muted
          statusLabel={(s) => (s.status === "COMPLETED" ? "Completed" : "Left class")}
          classId={teachingClass.id}
        />
      </div>
    </article>
  );
}

function RosterColumn({
  title,
  rows,
  empty,
  muted = false,
  statusLabel,
  classId,
}: {
  title: string;
  rows: TeachingStudent[];
  empty: string;
  muted?: boolean;
  statusLabel?: (student: TeachingStudent) => string;
  classId: string;
}) {
  return (
    <div className={["px-4 py-3.5 sm:px-5", muted ? "bg-[#fafafa]" : ""].join(" ")}>
      <p className="m-0 text-[12px] font-medium uppercase tracking-[0.05em] text-[#5f6368]">
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="m-0 mt-2 text-[13px] text-[#80868b]">{empty}</p>
      ) : (
        <ul className="m-0 mt-2 list-none space-y-2 p-0">
          {rows.map((student) => (
            <li key={student.studentId} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[11px] font-semibold text-[#174ea6]"
              >
                {student.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/instructor/classes/${classId}/roster#student-${student.studentId}`}
                  className="block truncate text-[13.5px] font-medium text-[#202124] no-underline hover:underline"
                >
                  {student.name}
                </Link>
              </div>
              {statusLabel ? (
                <span className="shrink-0 text-[11px] font-medium text-[#80868b]">
                  {statusLabel(student)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentFollowUpRow({ item }: { item: StudentAttentionItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; message?: string }>({
    kind: "idle",
  });

  function complete() {
    startTransition(async () => {
      if (item.kind === "feedback_waiting" && item.assignmentId && item.submissionId) {
        const feedbackResult = await submitInstructorAssignmentFeedback({
          offeringId: item.classId,
          assignmentId: item.assignmentId,
          submissionId: item.submissionId,
          feedback: note,
        });
        if (!feedbackResult.ok) {
          setState({ kind: "error", message: feedbackResult.error });
          return;
        }
        setState({ kind: "done", message: "Feedback sent to the student." });
        router.refresh();
        return;
      }
      const result = await completeInstructorStudentFollowUp({
        offeringId: item.classId,
        studentId: item.studentId,
        actionId: item.actionId ?? undefined,
        attentionKey: item.key,
        reason: item.reason,
        note,
      });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: "Follow-up recorded." });
      router.refresh();
    });
  }

  return (
    <article id={`student-${item.studentId}`} className="scroll-mt-4 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="m-0 text-[15px] font-semibold text-[#202124]">{item.studentName}</h3>
            <Link
              href={`/instructor/classes/${item.classId}/roster`}
              className="text-[12.5px] font-medium text-brand-700 no-underline hover:underline"
            >
              {item.className}
            </Link>
          </div>
          <p className="m-0 mt-2 text-[13px] leading-5 text-[#5f6368]">{item.reason}</p>
          <p className="m-0 mt-1.5 text-[12.5px] font-medium text-[#3c4043]">
            Expected: {item.expectedAction}
          </p>
          {item.workUrl ? (
            <a
              href={item.workUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-[13px] font-semibold text-brand-700 hover:underline"
            >
              Open submitted work ↗
            </a>
          ) : null}
          {item.workText ? (
            <div className="mt-2 rounded-[10px] border border-[#dadce0] bg-[#f8f9fa] p-3 text-[12.5px] leading-5 text-[#5f6368]">
              {item.workText}
            </div>
          ) : null}
        </div>

        <div className="rounded-[12px] border border-[#dadce0] bg-[#f8f9fa] p-3.5">
          <label className="block text-[12px] font-semibold text-[#5f6368]">
            {item.kind === "feedback_waiting" ? "Feedback for the student" : "What happened?"}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={
                item.kind === "feedback_waiting"
                  ? "Name what worked and one useful next step."
                  : "Example: Spoke with the family. Student will return Tuesday."
              }
              className="mt-1.5 w-full resize-y rounded-[8px] border border-[#dadce0] bg-white px-3 py-2 text-[13px] font-normal leading-5 text-[#202124] outline-none focus:border-brand-400"
            />
          </label>
          {state.kind !== "idle" ? (
            <p
              role="status"
              className={cn(
                "m-0 mt-2 text-[12px] font-semibold",
                state.kind === "done" ? "text-complete-700" : "text-blocked-700",
              )}
            >
              {state.message}
            </p>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={complete}
            loading={pending}
            disabled={pending || note.trim().length < 3}
            className="mt-3 w-full"
          >
            {item.kind === "feedback_waiting" ? "Send feedback" : "Record and complete follow-up"}
          </Button>
        </div>
      </div>
    </article>
  );
}
