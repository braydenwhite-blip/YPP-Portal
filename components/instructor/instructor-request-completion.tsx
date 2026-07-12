"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, cn } from "@/components/ui-v2";
import { completeAssignedInstructorRequest } from "@/lib/classes/instructor-request-actions";
import type { LeadershipRequest } from "@/lib/classes/instructor-workspace";

export function InstructorRequestCompletion({ request }: { request: LeadershipRequest }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; message?: string }>({ kind: "idle" });

  function complete() {
    startTransition(async () => {
      const result = await completeAssignedInstructorRequest({ actionId: request.id, note });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: "YPP request completed." });
      router.refresh();
    });
  }

  return (
    <article id={`ypp-request-${request.id}`} className="scroll-mt-4 p-4">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="w-full text-left">
        <p className="m-0 text-[13.5px] font-semibold text-ink">{request.title}</p>
        <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted">
          {request.requestedBy} · due {request.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        <span className="mt-2 inline-flex text-[12px] font-semibold text-brand-700">{expanded ? "Hide completion" : "Complete here"}</span>
      </button>
      {expanded ? (
        <div className="mt-3 rounded-[10px] border border-line-card bg-surface-soft p-3">
          <p className="m-0 text-[12.5px] leading-5 text-ink-muted">{request.reason}</p>
          <label className="mt-3 block text-[12px] font-semibold text-ink-muted">
            Completion note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="What did you finish or send?" className="mt-1 w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-2 text-[12.5px] font-normal text-ink outline-none focus:border-brand-400" />
          </label>
          {state.kind !== "idle" ? <p role="status" className={cn("m-0 mt-2 text-[12px] font-semibold", state.kind === "done" ? "text-complete-700" : "text-blocked-700")}>{state.message}</p> : null}
          <Button variant="primary" size="sm" onClick={complete} loading={pending} disabled={pending || note.trim().length < 3} className="mt-3 w-full">Mark request complete</Button>
        </div>
      ) : null}
    </article>
  );
}

