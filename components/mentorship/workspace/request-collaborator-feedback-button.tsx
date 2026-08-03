"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  ModalFooterV2,
  ModalV2,
  cn,
} from "@/components/ui-v2";
import {
  requestCollaboratorFeedback,
  searchCollaboratorCandidates,
  type CollaboratorCandidate,
} from "@/lib/mentorship/collaborator-feedback-actions";

/**
 * Mentor CTA — pick colleagues and ask them for feedback about this mentee.
 * Recipients write from People → that person's profile.
 */
export function RequestCollaboratorFeedbackButton({
  menteeId,
  menteeFirstName,
}: {
  menteeId: string;
  menteeFirstName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [candidates, setCandidates] = useState<CollaboratorCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    startSearch(async () => {
      try {
        const rows = await searchCollaboratorCandidates({ menteeId, q: q || null });
        setCandidates(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load people.");
      }
    });
  }, [open, menteeId, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    setError(null);
    setDoneMessage(null);
    startTransition(async () => {
      try {
        const res = await requestCollaboratorFeedback({
          menteeId,
          collaboratorIds: [...selected],
          note: note.trim() || null,
        });
        const parts: string[] = [];
        if (res.notified > 0) {
          parts.push(
            `Asked ${res.notified} colleague${res.notified === 1 ? "" : "s"}.`,
          );
        }
        if (res.alreadySubmitted > 0) {
          parts.push(
            `${res.alreadySubmitted} already submitted this month.`,
          );
        }
        setDoneMessage(parts.join(" ") || "Done.");
        setSelected(new Set());
        router.refresh();
        if (res.notified > 0) {
          window.setTimeout(() => {
            setOpen(false);
            setDoneMessage(null);
            setNote("");
            setQ("");
          }, 900);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send requests.");
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          setError(null);
          setDoneMessage(null);
        }}
      >
        Request feedback
      </Button>

      <ModalV2
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        labelledBy="request-collab-feedback-title"
        locked={pending}
        size="md"
      >
        <div className="flex flex-col gap-3">
          <div>
            <h2
              id="request-collab-feedback-title"
              className="m-0 text-[17px] font-semibold text-ink"
            >
              Request feedback about {menteeFirstName}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Pick people who worked with them. They&apos;ll see the request on
              People and write notes there — private to you.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted">
              Search people
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or email"
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
            />
          </label>

          <ul className="m-0 max-h-[240px] list-none space-y-1.5 overflow-y-auto p-0">
            {searching && candidates.length === 0 ? (
              <li className="px-1 py-3 text-[13px] text-ink-muted">Loading…</li>
            ) : null}
            {!searching && candidates.length === 0 ? (
              <li className="px-1 py-3 text-[13px] text-ink-muted">
                No matches. Try another name.
              </li>
            ) : null}
            {candidates.map((person) => {
              const checked = selected.has(person.id);
              return (
                <li key={person.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[10px] border border-line-soft px-3 py-2.5",
                      checked && "border-brand-300 bg-brand-50/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand-600"
                      checked={checked}
                      onChange={() => toggle(person.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-ink">
                        {person.name}
                      </span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {[person.primaryRole, person.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted">
              Note for them (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={`e.g. Worked with ${menteeFirstName} on the spring cohort…`}
              className="resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
            />
          </label>

          {error ? (
            <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
          ) : null}
          {doneMessage ? (
            <p className="m-0 text-[12.5px] font-medium text-complete-800">
              {doneMessage}
            </p>
          ) : null}
        </div>

        <ModalFooterV2>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={selected.size === 0}
            onClick={send}
          >
            Send {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}
