"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isNavHrefActive, resolveNavModel } from "@/lib/navigation/resolve-nav";
import type { NavLink } from "@/lib/navigation/types";

/** Counts passed from the server layout for notification badges. */
export interface NavBadges {
  notifications?: number;
  messages?: number;
  approvals?: number;
}

interface NavState {
  moreOpen: boolean;
  openGroups: Record<string, boolean>;
}

function storageKeyForRole(primaryRole: string): string {
  return `ypp-nav-v2:${primaryRole}`;
}

function loadSavedState(key: string): NavState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<NavState>;
    return {
      moreOpen: parsed.moreOpen === true,
      openGroups: parsed.openGroups ?? {},
    };
  } catch {
    return null;
  }
}

function saveState(key: string, state: NavState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage full or unavailable.
  }
}

function matchesSearch(item: NavLink, searchLower: string): boolean {
  if (!searchLower) return true;

  const aliasMatch = item.searchAliases?.some((alias) => alias.toLowerCase().includes(searchLower));
  return (
    item.label.toLowerCase().includes(searchLower) ||
    item.href.toLowerCase().includes(searchLower) ||
    aliasMatch === true
  );
}

export default function Nav({
  roles = [],
  primaryRole,
  awardTier,
  badges,
  onNavigate,
}: {
  roles?: string[];
  primaryRole?: string | null;
  awardTier?: string;
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const model = useMemo(
    () =>
      resolveNavModel({
        roles,
        primaryRole,
        awardTier,
        pathname,
      }),
    [awardTier, pathname, primaryRole, roles],
  );

  const storageKey = useMemo(() => storageKeyForRole(model.primaryRole), [model.primaryRole]);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchLower = search.trim().toLowerCase();

  const [moreOpen, setMoreOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const defaultGroupState = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const group of model.more) {
      next[group.label] = group.items.some((item) => isNavHrefActive(item.href, pathname));
    }
    return next;
  }, [model.more, pathname]);

  useEffect(() => {
    const saved = loadSavedState(storageKey);
    if (!saved) {
      setMoreOpen(false);
      setOpenGroups(defaultGroupState);
      return;
    }

    setMoreOpen(saved.moreOpen);
    setOpenGroups({ ...defaultGroupState, ...saved.openGroups });
  }, [defaultGroupState, storageKey]);

  useEffect(() => {
    setOpenGroups((previous) => {
      const next: Record<string, boolean> = { ...previous };

      for (const group of model.more) {
        if (next[group.label] === undefined) {
          next[group.label] = group.items.some((item) => isNavHrefActive(item.href, pathname));
        }
      }

      for (const label of Object.keys(next)) {
        if (!model.more.some((group) => group.label === label)) {
          delete next[label];
        }
      }

      return next;
    });
  }, [model.more, pathname]);

  const isFirstPersist = useRef(true);
  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }

    saveState(storageKey, {
      moreOpen,
      openGroups,
    });
  }, [moreOpen, openGroups, storageKey]);

  const toggleGroup = useCallback((groupLabel: string) => {
    setOpenGroups((previous) => ({
      ...previous,
      [groupLabel]: !previous[groupLabel],
    }));
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCore = useMemo(
    () => model.core.filter((item) => matchesSearch(item, searchLower)),
    [model.core, searchLower],
  );

  const filteredMore = useMemo(
    () =>
      model.more
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => matchesSearch(item, searchLower)),
        }))
        .filter((group) => group.items.length > 0),
    [model.more, searchLower],
  );

  const totalCore = filteredCore.length;
  const totalMore = filteredMore.reduce((sum, group) => sum + group.items.length, 0);
  const totalResults = totalCore + totalMore;

  const hasSearch = searchLower.length > 0;
  const effectiveMoreOpen = hasSearch ? true : moreOpen;
  const hiddenCount = model.more.reduce((sum, group) => sum + group.items.length, 0);
  const moreCountLabel = hasSearch ? totalMore : hiddenCount;

  const renderNavLink = (item: NavLink): JSX.Element => {
    const isActive = isNavHrefActive(item.href, pathname);
    const badgeCount = item.badgeKey && badges ? badges[item.badgeKey] : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={isActive ? "active" : undefined}
        onClick={onNavigate}
      >
        <span className="nav-icon">{item.icon}</span>
        <span className="nav-item-label">{item.label}</span>
        {badgeCount && badgeCount > 0 ? (
          <span className="nav-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="nav">
      <div className="nav-search-wrapper">
        <input
          ref={searchRef}
          type="text"
          className="nav-search"
          placeholder="Search nav... (Ctrl+K)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search navigation"
        />
        {search && (
          <button
            type="button"
            className="nav-search-clear"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            {"✕"}
          </button>
        )}
      </div>

      {totalResults === 0 ? (
        <div className="nav-empty">No results for &ldquo;{search}&rdquo;</div>
      ) : (
        <>
          <section className="nav-main-tools">
            <p className="nav-block-title">Your Main Tools</p>
            <div className="nav-main-items">{filteredCore.map(renderNavLink)}</div>
          </section>

          {filteredMore.length > 0 ? (
            <section className="nav-more">
              <button
                type="button"
                className="nav-more-toggle"
                onClick={() => setMoreOpen((previous) => !previous)}
                aria-expanded={effectiveMoreOpen}
                aria-label={`${effectiveMoreOpen ? "Collapse" : "Expand"} more navigation links`}
                disabled={hasSearch}
              >
                <span className="nav-more-label">More ({moreCountLabel})</span>
                <span className={`nav-more-chevron ${effectiveMoreOpen ? "open" : ""}`}>{"›"}</span>
              </button>

              {effectiveMoreOpen ? (
                <div className="nav-more-content">
                  {filteredMore.map((group) => {
                    const groupHasActive = group.items.some((item) => isNavHrefActive(item.href, pathname));
                    const groupOpen = hasSearch
                      ? true
                      : (openGroups[group.label] ?? false) || groupHasActive;

                    return (
                      <div key={group.label} className="nav-more-group">
                        <button
                          type="button"
                          className={`nav-more-group-toggle ${groupHasActive ? "nav-section-active" : ""}`}
                          onClick={() => toggleGroup(group.label)}
                          aria-expanded={groupOpen}
                          aria-label={`${groupOpen ? "Collapse" : "Expand"} ${group.label}`}
                          disabled={hasSearch}
                        >
                          <span className="nav-section-label">{group.label}</span>
                          <span className={`nav-section-chevron ${groupOpen ? "open" : ""}`}>{"›"}</span>
                        </button>

                        {groupOpen ? (
                          <div className="nav-more-group-items">{group.items.map(renderNavLink)}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </nav>
  );
}
