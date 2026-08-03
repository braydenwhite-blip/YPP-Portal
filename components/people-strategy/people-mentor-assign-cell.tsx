"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalFooterV2, ModalV2, cn } from "@/components/ui-v2";
import { reassignPrimaryMentor } from "@/lib/mentorship-reassign-actions";
import { formatRoleLabel } from "@/lib/user-title";

type MentorCandidate = {
  id: string;
  name: string;
  role?: string | null;
  title?: string | null;
};

function candidateRoleLabel(c: MentorCandidate): string {
  const title = c.title?.trim();
  if (title) return title;
  return formatRoleLabel(c.role);
}

/**
 * Compact mentor cell for the admin People dashboard — shows current mentor
 * and lets officers assign / change without leaving the roster.
 */
export function PeopleMentorAssignCell({
  menteeId,
  menteeName,
  mentorId,
  mentorName,
  candidates,
  canAssign,
}: {
  menteeId: string;
  menteeName: string;
  mentorId: string | null;
  mentorName: string | null;
  candidates: MentorCandidate[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(mentorId ?? "");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = candidates.filter((c) => c.id !== menteeId);
    if (!q) return base.slice(0, 80);
    return base
      .filter((c) => {
        const role = candidateRoleLabel(c).toLowerCase();
        return c.name.toLowerCase().includes(q) || role.includes(q);
      })
      .slice(0, 80);
  }, [candidates, menteeId, query]);

  function openModal(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setSelected(mentorId ?? "");
    setQuery("");
    setError(null);
    setOpen(true);
  }

  function save() {
    if (!selected) {
      setError("Pick a mentor.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await reassignPrimaryMentor({
          menteeId,
          newMentorId: selected,
          reason: mentorId ? "Changed from People dashboard" : "Assigned from People dashboard",
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update mentor.");
      }
    });
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
        <span
          className={cn(
            "truncate text-[13px] font-semibold leading-snug",
            mentorName ? "text-[#3a3a52]" : "text-[#c0392b]",
          )}
          title={mentorName ?? undefined}
        >
          {mentorName ?? "Unassigned"}
        </span>
        {canAssign ? (
          <button
            type="button"
            onClick={openModal}
            className="w-fit border-0 bg-transparent p-0 text-left text-[12px] font-semibold text-brand-700 hover:text-brand-800 hover:underline"
          >
            {mentorName ? "Change" : "Assign mentor"}
          </button>
        ) : null}
      </div>

      <ModalV2
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        labelledBy={`assign-mentor-${menteeId}`}
        locked={pending}
        size="sm"
        role="dialog"
      >
        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <h2
              id={`assign-mentor-${menteeId}`}
              className="m-0 text-[17px] font-semibold text-ink"
            >
              {mentorName ? "Change mentor" : "Assign mentor"}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              For {menteeName}. Prior mentorship stays in history — nothing is deleted.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or role"
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
            />
          </label>

          <ul className="m-0 max-h-[240px] list-none space-y-1 overflow-y-auto p-0">
            {filtered.length === 0 ? (
              <li className="px-1 py-3 text-[13px] text-ink-muted">No matches.</li>
            ) : (
              filtered.map((c) => {
                const checked = selected === c.id;
                const roleLabel = candidateRoleLabel(c);
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-soft px-3 py-2.5",
                        checked && "border-brand-300 bg-brand-50/50",
                      )}
                    >
                      <input
                        type="radio"
                        name={`mentor-${menteeId}`}
                        className="size-4 shrink-0 accent-brand-600"
                        checked={checked}
                        onChange={() => setSelected(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {c.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                          {roleLabel}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          {error ? (
            <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
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
            disabled={!selected}
            onClick={save}
          >
            Save
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}
