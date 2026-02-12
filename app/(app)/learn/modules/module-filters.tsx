"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface ModuleFiltersProps {
  passionIds: string[];
  currentPassion?: string;
  currentLevel?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export default function ModuleFilters({
  passionIds,
  currentPassion,
  currentLevel,
  currentStatus,
  currentSearch,
}: ModuleFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasFilters = currentPassion || currentLevel || currentStatus || currentSearch;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <input
          type="text"
          className="input"
          placeholder="Search modules..."
          defaultValue={currentSearch ?? ""}
          style={{ maxWidth: 200, marginTop: 0, padding: "7px 12px", fontSize: 13 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateFilter("q", (e.target as HTMLInputElement).value);
            }
          }}
        />

        {/* Passion filter */}
        <select
          className="input"
          value={currentPassion ?? ""}
          onChange={(e) => updateFilter("passion", e.target.value)}
          style={{ maxWidth: 160, marginTop: 0, padding: "7px 12px", fontSize: 13 }}
        >
          <option value="">All Passions</option>
          {passionIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        {/* Level filter */}
        <select
          className="input"
          value={currentLevel ?? ""}
          onChange={(e) => updateFilter("level", e.target.value)}
          style={{ maxWidth: 140, marginTop: 0, padding: "7px 12px", fontSize: 13 }}
        >
          <option value="">All Levels</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="EXPERT">Expert</option>
        </select>

        {/* Status filter */}
        <select
          className="input"
          value={currentStatus ?? ""}
          onChange={(e) => updateFilter("status", e.target.value)}
          style={{ maxWidth: 140, marginTop: 0, padding: "7px 12px", fontSize: 13 }}
        >
          <option value="">All Status</option>
          <option value="not-started">Not Started</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        {/* Clear */}
        {hasFilters && (
          <button
            type="button"
            className="button small outline"
            onClick={clearFilters}
            style={{ marginTop: 0 }}
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
