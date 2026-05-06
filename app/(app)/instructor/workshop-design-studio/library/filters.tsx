"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { difficultyLabel } from "@/lib/workshop-proposal-constants";
import type { WorkshopProposalDifficulty } from "@prisma/client";

const ALL_DIFFICULTIES: WorkshopProposalDifficulty[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
];

type LibraryFiltersProps = {
  categories: string[];
  currentSearch: string;
  currentCategory: string;
  currentDifficulty: string;
};

export function LibraryFilters({
  categories,
  currentSearch,
  currentCategory,
  currentDifficulty,
}: LibraryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAny = useMemo(
    () => Boolean(currentSearch || currentCategory || currentDifficulty),
    [currentSearch, currentCategory, currentDifficulty]
  );

  // Cancel any pending debounce on unmount so we don't stomp on a navigation.
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.replace(`?${params.toString()}`);
  }

  function debouncedUpdateSearch(value: string) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => update({ q: value }), 200);
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "end",
      }}
    >
      <label style={{ display: "grid", gap: 4, flex: "2 1 240px", minWidth: 200 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Search</span>
        <input
          className="input"
          type="search"
          defaultValue={currentSearch}
          placeholder="Title, topic, tag…"
          onChange={(e) => debouncedUpdateSearch(e.target.value)}
        />
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Category</span>
        <select
          className="input"
          value={currentCategory}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Difficulty</span>
        <select
          className="input"
          value={currentDifficulty}
          onChange={(e) => update({ difficulty: e.target.value })}
        >
          <option value="">All</option>
          {ALL_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {difficultyLabel(d)}
            </option>
          ))}
        </select>
      </label>
      {hasAny ? (
        <button
          type="button"
          className="button small secondary"
          onClick={() => update({ q: "", category: "", difficulty: "" })}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
