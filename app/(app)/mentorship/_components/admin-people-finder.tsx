"use client";

import { useMemo, useState } from "react";

export type MentorshipPersonIndexItem = {
  id: string;
  name: string;
  context: string;
  mentor: string | null;
  state: string;
  owner: string;
  needsAttention: boolean;
};

export function AdminPeopleFinder({ people }: { people: MentorshipPersonIndexItem[] }) {
  const [query, setQuery] = useState("");
  const [browseAll, setBrowseAll] = useState(false);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      people
        .filter((person) =>
          normalized
            ? `${person.name} ${person.context} ${person.mentor ?? ""} ${person.state}`
                .toLowerCase()
                .includes(normalized)
            : true
        )
        .slice(0, 12),
    [normalized, people]
  );
  const showResults = normalized.length > 0 || browseAll;

  return (
    <section aria-labelledby="mentorship-people-heading" className="border-t border-line-soft pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="mentorship-people-heading" className="m-0 text-[16px] font-bold text-ink">
            Find a person
          </h2>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Open the same Mentorship workspace from any queue or search result.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={browseAll}
          onClick={() => setBrowseAll((current) => !current)}
          className={
            browseAll
              ? "rounded-lg bg-ink px-3 py-2 text-[12px] font-semibold text-white"
              : "rounded-lg border border-line-soft bg-surface px-3 py-2 text-[12px] font-semibold text-ink"
          }
        >
          {browseAll ? "Hide list" : `Browse all ${people.length}`}
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by person, role, mentor, or current step"
        aria-label="Search mentorship people"
        className="mt-3 h-11 w-full rounded-xl border border-line-soft bg-surface px-4 text-[13.5px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      {showResults && visible.length > 0 ? (
        <ul className="m-0 mt-2 list-none divide-y divide-line-soft p-0">
          {visible.map((person) => (
            <li key={person.id}>
              <a
                href={`/mentorship/people/${person.id}`}
                className="grid gap-1 px-2 py-3 text-inherit no-underline transition-colors hover:bg-surface-soft sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)] sm:items-center sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{person.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {person.context}
                    {person.mentor ? ` · Mentor: ${person.mentor}` : " · No mentor"}
                  </span>
                </span>
                <span className="text-[12.5px] text-ink-muted sm:text-right">
                  <strong className="font-semibold text-ink">{person.state}</strong> · {person.owner}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : showResults ? (
        <p className="m-0 mt-4 text-[13px] text-ink-muted">
          No people match that search.
        </p>
      ) : null}
    </section>
  );
}
