"use client";

import { useMemo, useState } from "react";

import { Button, cn } from "@/components/ui-v2";

export type MeetingPerson = { id: string; name: string; email: string };

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

/**
 * Dead-simple attendee picker: search, tap to add, add everyone, remove chips.
 */
export function MeetingPeoplePicker({
  people,
  selectedIds,
  onChange,
  currentUserId,
  label = "Who's invited?",
  hint = "Search or tap Add everyone — you can always change this later.",
  hideHeader = false,
}: {
  people: MeetingPerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  currentUserId?: string;
  label?: string;
  hint?: string;
  /** When true, parent FormSection supplies the title/hint. */
  hideHeader?: boolean;
}) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedPeople = useMemo(
    () =>
      selectedIds
        .map((id) => people.find((p) => p.id === id))
        .filter(Boolean) as MeetingPerson[],
    [selectedIds, people],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = people.filter((p) => !selectedSet.has(p.id));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [people, query, selectedSet]);

  function add(id: string) {
    if (selectedSet.has(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function addAll() {
    onChange(people.map((p) => p.id));
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <p className="m-0 text-[14px] font-semibold text-ink">{label}</p>
          {hint ? <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{hint}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addAll} disabled={people.length === 0}>
          Add everyone ({people.length})
        </Button>
        {currentUserId && !selectedSet.has(currentUserId) ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => add(currentUserId)}>
            Add me
          </Button>
        ) : null}
        {selectedIds.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
        ) : null}
      </div>

      {selectedPeople.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedPeople.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => remove(p.id)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-soft bg-surface py-1 pl-3 pr-2 text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-danger-300 hover:bg-danger-50"
              title="Click to remove"
            >
              <span className="truncate">{p.name || p.email}</span>
              <span className="text-[15px] leading-none text-ink-muted">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-[12px] border border-dashed border-line-soft bg-surface/60 px-3 py-2.5 text-[13px] text-ink-muted">
          No one added yet — use search or Add everyone.
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        className={inputClass}
        autoComplete="off"
      />

      {query.trim() ? (
        <ul className="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto rounded-[14px] border border-line-soft bg-surface p-1.5 shadow-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-ink-muted">
              {query.trim() ? `No matches for “${query.trim()}”.` : "Everyone is already invited."}
            </li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-brand-50",
                  )}
                >
                  <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">
                    {p.name || p.email}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-brand-700">+ Add</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
