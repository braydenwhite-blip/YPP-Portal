"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, EmptyStateV2, cn } from "@/components/ui-v2";
import { completeInstructorStudentFollowUp } from "@/lib/classes/student-follow-up-actions";
import { submitInstructorAssignmentFeedback } from "@/lib/classes/assignment-feedback-actions";
import type { StudentAttentionItem } from "@/lib/classes/instructor-workspace";

export function InstructorStudentsView({
  items,
  className,
}: {
  items: StudentAttentionItem[];
  className?: string | null;
}) {
  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">Teaching</p>
        <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">Students needing attention</h1>
        <p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-ink-muted">
          {className ? `${className}: ` : ""}Only students with a current attendance or required-work reason appear here. Record the outcome once; the item then clears automatically.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyStateV2
            title="No unresolved student follow-up"
            body="No connected student currently has a repeated-absence or overdue-required-work reason that still needs your response."
          />
        </div>
      ) : (
        <section className="mt-8 divide-y divide-line-card overflow-hidden rounded-[18px] border border-line-card bg-surface shadow-card">
          {items.map((item) => <StudentFollowUpRow key={item.key} item={item} />)}
        </section>
      )}

      <p className="m-0 mt-6 text-[12.5px] leading-5 text-ink-muted">
        This page uses class enrollment, fully recorded attendance, published required work, and follow-up records. It does not expose private advising or leadership-only notes.
      </p>
    </main>
  );
}

function StudentFollowUpRow({ item }: { item: StudentAttentionItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; message?: string }>({ kind: "idle" });

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
    <article id={`student-${item.studentId}`} className="scroll-mt-4 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-0 text-[17px] font-semibold text-ink">{item.studentName}</h2>
            <Link href={`/instructor/classes/${item.classId}#student-${item.studentId}`} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
              {item.className}
            </Link>
          </div>
          <p className="m-0 mt-3 text-[13.5px] leading-6 text-ink-muted">{item.reason}</p>
          <p className="m-0 mt-2 text-[13px] font-medium leading-5 text-ink">Expected action: {item.expectedAction}</p>
          {item.workUrl ? (
            <a href={item.workUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 hover:underline">Open submitted work ↗</a>
          ) : null}
          {item.workText ? (
            <div className="mt-3 rounded-[10px] border border-line-card bg-surface-soft p-3 text-[12.5px] leading-5 text-ink-muted">{item.workText}</div>
          ) : null}
        </div>

        <div className="rounded-[12px] border border-line-card bg-surface-soft p-4">
          <label className="block text-[12px] font-semibold text-ink-muted">
            {item.kind === "feedback_waiting" ? "Feedback for the student" : "What happened?"}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={
                item.kind === "feedback_waiting"
                  ? "Name what worked and one useful next step."
                  : "Example: Spoke with the family. Student will return Tuesday and complete the worksheet by Friday."
              }
              className="mt-1.5 w-full resize-y rounded-[8px] border border-line-card bg-surface px-3 py-2 text-[13px] font-normal leading-5 text-ink outline-none focus:border-brand-400"
            />
          </label>
          {state.kind !== "idle" ? (
            <p role="status" className={cn("m-0 mt-2 text-[12px] font-semibold", state.kind === "done" ? "text-complete-700" : "text-blocked-700")}>{state.message}</p>
          ) : null}
          <Button variant="primary" size="sm" onClick={complete} loading={pending} disabled={pending || note.trim().length < 3} className="mt-3 w-full">
            {item.kind === "feedback_waiting" ? "Send feedback" : "Record and complete follow-up"}
          </Button>
        </div>
      </div>
    </article>
  );
}
