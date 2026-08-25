"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  addChapterMember,
  removeChapterMember,
  removeChapterPresident,
  searchPeopleForChapter,
  setChapterPresident,
  type ChapterPersonHit,
} from "@/lib/chapters/admin-roster-actions";
import { Button, cn } from "@/components/ui-v2";

export type ChapterMember = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  isPresident: boolean;
};

function roleHeading(label: string) {
  if (label === "CHAPTER_PRESIDENT") return "Presidents";
  if (label === "INSTRUCTOR") return "Instructors";
  if (label === "STUDENT") return "Students";
  if (label === "MENTOR") return "Mentors";
  if (label === "PARENT") return "Parents";
  if (label === "STAFF") return "Staff";
  return "Everyone else";
}

function PeopleSearch({
  chapterId,
  placeholder,
  onPick,
  hideIfInChapter,
  hideUserIds,
  pickLabel,
}: {
  chapterId: string;
  placeholder: string;
  onPick: (person: ChapterPersonHit) => void;
  hideIfInChapter?: boolean;
  hideUserIds?: string[];
  pickLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ChapterPersonHit[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  const hideKey = (hideUserIds ?? []).join(",");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const hidden = new Set(hideKey ? hideKey.split(",") : []);
    const t = window.setTimeout(async () => {
      const rows = await searchPeopleForChapter({ query: q, chapterId });
      if (seq.current !== id) return;
      setHits(
        rows.filter((r) => {
          if (hidden.has(r.id)) return false;
          if (hideIfInChapter && r.chapterId === chapterId) return false;
          return true;
        })
      );
      setSearching(false);
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, chapterId, hideIfInChapter, hideKey]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[10px] border border-line-card bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-ink-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {query.trim().length >= 2 ? (
        <ul className="mt-2 m-0 list-none overflow-hidden rounded-[10px] border border-line-card bg-surface p-0">
          {searching && hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-muted">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-muted">No one matches.</li>
          ) : (
            hits.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-line-card px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13.5px] font-semibold text-ink">{p.name}</p>
                  <p className="m-0 truncate text-[12px] text-ink-muted">
                    {p.email}
                    {p.chapterName ? ` · ${p.chapterName}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onPick(p);
                    setQuery("");
                    setHits([]);
                  }}
                >
                  {pickLabel}
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function AdminChapterRoster({
  chapterId,
  presidents,
  members,
}: {
  chapterId: string;
  presidents: { id: string; name: string; email: string }[];
  members: ChapterMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const groups = new Map<string, ChapterMember[]>();
  for (const m of members) {
    const key = m.isPresident ? "Presidents" : roleHeading(m.roleLabel);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const order = [
    "President",
    "Presidents",
    "Instructors",
    "Students",
    "Mentors",
    "Parents",
    "Staff",
    "Everyone else",
  ];
  const grouped = order
    .filter((k) => (groups.get(k) ?? []).length > 0)
    .map((k) => ({ heading: k, people: groups.get(k)! }));

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-70")}>
      {error ? (
        <p className="m-0 rounded-[10px] bg-blocked-50 px-3 py-2 text-[13px] text-blocked-700">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        <div className="border-b border-line-card px-5 py-4">
          <h2 className="m-0 text-[16px] font-bold text-ink">
            Chapter presidents
            {presidents.length > 0 ? (
              <span className="ml-2 text-[13px] font-semibold text-ink-muted">
                {presidents.length}
              </span>
            ) : null}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Add as many CPs as this chapter needs. Search anyone and tap Set as CP.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {presidents.length === 0 ? (
            <p className="m-0 rounded-[10px] bg-progress-50 px-3 py-2.5 text-[13px] font-medium text-progress-700">
              No president yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {presidents.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/people/${p.id}`}
                      className="text-[15px] font-bold text-ink no-underline hover:text-brand-700"
                    >
                      {p.name}
                    </Link>
                    <p className="m-0 mt-0.5 truncate text-[13px] text-ink-muted">{p.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      run(() => removeChapterPresident({ chapterId, userId: p.id }))
                    }
                  >
                    Unassign
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <PeopleSearch
            chapterId={chapterId}
            placeholder="Search by name or email"
            pickLabel="Set as CP"
            hideUserIds={presidents.map((p) => p.id)}
            onPick={(p) => run(() => setChapterPresident({ chapterId, userId: p.id }))}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        <div className="border-b border-line-card px-5 py-4">
          <h2 className="m-0 text-[16px] font-bold text-ink">
            Members
            <span className="ml-2 text-[13px] font-semibold text-ink-muted">{members.length}</span>
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Add people to this chapter. Remove them if they belong somewhere else.
          </p>
        </div>
        <div className="px-5 py-4">
          <PeopleSearch
            chapterId={chapterId}
            placeholder="Add someone by name or email"
            pickLabel="Add"
            hideIfInChapter
            onPick={(p) => run(() => addChapterMember({ chapterId, userId: p.id }))}
          />
        </div>
        {grouped.length === 0 ? (
          <p className="m-0 border-t border-line-card px-5 py-8 text-center text-[13px] text-ink-muted">
            No members yet. Search above to add someone.
          </p>
        ) : (
          grouped.map((g) => (
            <div key={g.heading} className="border-t border-line-card">
              <p className="m-0 px-5 pt-3 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                {g.heading}
              </p>
              <ul className="m-0 list-none p-0">
                {g.people.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/people/${m.id}`}
                        className="text-[14px] font-semibold text-ink no-underline hover:text-brand-700"
                      >
                        {m.name}
                      </Link>
                      <p className="m-0 truncate text-[12.5px] text-ink-muted">{m.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!m.isPresident ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            run(() => setChapterPresident({ chapterId, userId: m.id }))
                          }
                        >
                          Make CP
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          run(() => removeChapterMember({ chapterId, userId: m.id }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
