"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { PassionIsland } from "@/lib/world-actions";
import { CATEGORY_THEMES, getTheme } from "../constants";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Search + Category Filter — Find & highlight islands
// ═══════════════════════════════════════════════════════════════

interface SearchFilterProps {
  islands: PassionIsland[];
  onFilter: (filteredIds: Set<string> | null) => void;
  onFocusIsland?: (island: PassionIsland) => void;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_THEMES);

export function SearchFilter({ islands, onFilter, onFocusIsland }: SearchFilterProps) {
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute filtered island IDs
  const filtered = useMemo(() => {
    const hasQuery = query.trim().length > 0;
    const hasCategories = activeCategories.size > 0;

    if (!hasQuery && !hasCategories) return null; // null = show all

    const q = query.trim().toLowerCase();
    const result = new Set<string>();

    for (const island of islands) {
      const matchesQuery = !hasQuery || island.name.toLowerCase().includes(q) || island.category.toLowerCase().includes(q);
      const matchesCategory = !hasCategories || activeCategories.has(island.category);

      if (matchesQuery && matchesCategory) {
        result.add(island.id);
      }
    }

    return result;
  }, [query, activeCategories, islands]);

  // Push filter state upstream
  useEffect(() => {
    onFilter(filtered);
  }, [filtered, onFilter]);

  const toggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setActiveCategories(new Set());
  }, []);

  // Get categories that exist in the user's islands
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const island of islands) {
      cats.add(island.category);
    }
    return cats;
  }, [islands]);

  // Search results list
  const matchedIslands = useMemo(() => {
    if (!filtered) return [];
    return islands.filter((isl) => filtered.has(isl.id));
  }, [filtered, islands]);

  const hasFilter = query.trim().length > 0 || activeCategories.size > 0;

  return (
    <div
      className={`${styles.searchFilter} ${isExpanded ? styles.searchFilterExpanded : ""}`}
      role="search"
      aria-label="Search and filter islands"
    >
      {/* Toggle button when collapsed */}
      {!isExpanded ? (
        <button
          className={styles.searchToggle}
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          aria-label="Open island search"
          title="Search islands"
        >
          {"\u{1F50D}"}
        </button>
      ) : (
        <>
          {/* Search input */}
          <div className={styles.searchInputRow}>
            <span className={styles.searchIcon} aria-hidden="true">{"\u{1F50D}"}</span>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search islands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search islands by name or category"
            />
            {hasFilter && (
              <button className={styles.searchClear} onClick={clearAll} aria-label="Clear all filters" title="Clear filters">
                &times;
              </button>
            )}
            <button
              className={styles.searchCollapse}
              onClick={() => {
                setIsExpanded(false);
                clearAll();
              }}
              aria-label="Close search panel"
              title="Close search"
            >
              {"\u2715"}
            </button>
          </div>

          {/* Category pills */}
          <div className={styles.categoryPills} role="group" aria-label="Filter by category">
            {ALL_CATEGORIES.map((cat) => {
              const theme = CATEGORY_THEMES[cat];
              const isActive = activeCategories.has(cat);
              const exists = usedCategories.has(cat);
              if (!exists) return null;
              return (
                <button
                  key={cat}
                  className={`${styles.categoryPill} ${isActive ? styles.categoryPillActive : ""}`}
                  style={
                    isActive
                      ? { background: theme.gradient[0], borderColor: theme.gradient[0], color: "white" }
                      : { borderColor: `${theme.gradient[0]}40` }
                  }
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={isActive}
                  aria-label={`${cat.replace(/_/g, " ")} category${isActive ? " (active)" : ""}`}
                >
                  <span aria-hidden="true">{theme.emoji}</span>
                  <span>{cat.replace(/_/g, " ")}</span>
                </button>
              );
            })}
          </div>

          {/* Results list */}
          {hasFilter && (
            <div className={styles.searchResults} aria-live="polite">
              <div className={styles.searchResultsHeader}>
                {matchedIslands.length} island{matchedIslands.length !== 1 ? "s" : ""} found
              </div>
              {matchedIslands.length === 0 ? (
                <div className={styles.searchEmpty}>No islands match your search</div>
              ) : (
                <div className={styles.searchResultsList} role="listbox" aria-label="Search results">
                  {matchedIslands.map((island) => {
                    const theme = getTheme(island.category);
                    return (
                      <button
                        key={island.id}
                        className={styles.searchResultItem}
                        onClick={() => onFocusIsland?.(island)}
                        role="option"
                        aria-label={`${island.name}, Level ${island.currentLevel}, ${island.xpPoints} XP`}
                      >
                        <span className={styles.searchResultEmoji} aria-hidden="true">{theme.emoji}</span>
                        <div className={styles.searchResultInfo}>
                          <span className={styles.searchResultName}>{island.name}</span>
                          <span className={styles.searchResultMeta}>
                            Lv.{island.currentLevel} · {island.xpPoints} XP
                          </span>
                        </div>
                        <div
                          className={styles.searchResultDot}
                          style={{ background: theme.gradient[0] }}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
