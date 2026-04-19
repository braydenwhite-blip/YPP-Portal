"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { resolveNavActiveHref, resolveNavModel } from "@/lib/navigation/resolve-nav";
import { INSTRUCTOR_MINIMAL_GROUP_EMOJI } from "@/lib/navigation/instructor-v1-nav-layout";
import { STUDENT_MINIMAL_GROUP_EMOJI } from "@/lib/navigation/student-v1-nav-layout";
import type { NavGroup, NavLink } from "@/lib/navigation/types";

/** Counts passed from the server layout for notification badges. */
export interface NavBadges {
  notifications?: number;
  messages?: number;
  approvals?: number;
  chairQueueCount?: number;
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
  adminSubtypes,
  primaryRole,
  awardTier,
  badges,
  enabledFeatureKeys,
  onNavigate,
  unlockedSections,
  recentlyUnlockedGroups,
  lockedGroups: lockedGroupsProp,
  studentFullPortalExplorer,
  studentHasChapter,
  instructorFullPortalExplorer,
}: {
  roles?: string[];
  adminSubtypes?: string[];
  primaryRole?: string | null;
  awardTier?: string;
  badges?: NavBadges;
  enabledFeatureKeys?: Set<string>;
  onNavigate?: () => void;
  unlockedSections?: Set<string>;
  recentlyUnlockedGroups?: Set<string>;
  lockedGroups?: Map<string, string>;
  studentFullPortalExplorer?: boolean;
  /** When true, "Join a chapter" is hidden (user already has a chapter). */
  studentHasChapter?: boolean;
  instructorFullPortalExplorer?: boolean;
}) {
  const pathname = usePathname();

  const model = useMemo(
    () =>
      resolveNavModel({
        roles,
        adminSubtypes,
        primaryRole,
        awardTier,
        pathname,
        enabledFeatureKeys,
        unlockedSections,
        studentFullPortalExplorer,
        studentHasChapter,
        instructorFullPortalExplorer,
      }),
    [
      adminSubtypes,
      awardTier,
      enabledFeatureKeys,
      pathname,
      primaryRole,
      roles,
      unlockedSections,
      studentFullPortalExplorer,
      studentHasChapter,
      instructorFullPortalExplorer,
    ],
  );

  const allNavHrefs = useMemo(() => {
    const hrefs: string[] = [];
    for (const item of model.core) {
      hrefs.push(item.href);
    }
    for (const group of model.more) {
      for (const item of group.items) {
        hrefs.push(item.href);
      }
    }
    return hrefs;
  }, [model.core, model.more]);

  const activeNavHref = useMemo(
    () => resolveNavActiveHref(pathname, allNavHrefs),
    [pathname, allNavHrefs],
  );

  // Use locked groups from the model (computed from unlockedSections) or from explicit prop
  const lockedGroups = model.lockedGroups ?? lockedGroupsProp;

  const storageKey = useMemo(() => storageKeyForRole(model.primaryRole), [model.primaryRole]);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchLower = search.trim().toLowerCase();

  const [moreOpen, setMoreOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const defaultGroupState = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const group of model.more) {
      next[group.label] =
        activeNavHref !== null && group.items.some((item) => item.href === activeNavHref);
    }
    return next;
  }, [model.more, activeNavHref]);

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
          next[group.label] =
            activeNavHref !== null && group.items.some((item) => item.href === activeNavHref);
        }
      }

      for (const label of Object.keys(next)) {
        if (!model.more.some((group) => group.label === label)) {
          delete next[label];
        }
      }

      return next;
    });
  }, [model.more, activeNavHref]);

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

  const showStudentMinimalChrome =
    model.primaryRole === "STUDENT" && studentFullPortalExplorer !== true;
  const showInstructorMinimalChrome =
    model.primaryRole === "INSTRUCTOR" && instructorFullPortalExplorer !== true;
  const useMinimalFlatNavChrome = showStudentMinimalChrome || showInstructorMinimalChrome;
  const minimalGroupEmoji =
    model.primaryRole === "INSTRUCTOR" ? INSTRUCTOR_MINIMAL_GROUP_EMOJI : STUDENT_MINIMAL_GROUP_EMOJI;
  const studentHomeOnlyCore =
    showStudentMinimalChrome &&
    filteredCore.length === 1 &&
    filteredCore[0]?.href === "/";

  const hasSearch = searchLower.length > 0;
  const effectiveMoreOpen = hasSearch ? true : moreOpen;
  const hiddenCount = model.more.reduce((sum, group) => sum + group.items.length, 0);
  const moreCountLabel = hasSearch ? totalMore : hiddenCount;

  const renderNavLink = (item: NavLink, opts?: { nestedUnderTraining?: boolean }): JSX.Element => {
    const isActive = activeNavHref !== null && item.href === activeNavHref;
    const badgeCount = item.badgeKey && badges ? badges[item.badgeKey] : undefined;
    const nested = opts?.nestedUnderTraining === true;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={[isActive ? "active" : undefined, nested ? "nav-link--nested-under-training" : undefined]
          .filter(Boolean)
          .join(" ")}
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

  function renderCoreNavItems(): ReactNode[] {
    if (!showInstructorMinimalChrome) {
      return filteredCore.map((item) => renderNavLink(item));
    }
    const out: ReactNode[] = [];
    for (let i = 0; i < filteredCore.length; i += 1) {
      const item = filteredCore[i];
      if (item.href === "/instructor-training") {
        const next = filteredCore[i + 1];
        if (next?.href === "/instructor/lesson-design-studio") {
          out.push(
            <div key="instructor-training-with-studio" className="nav-training-group">
              {renderNavLink(item)}
              <div
                className="nav-training-group-sub"
                role="group"
                aria-label="Instructor training tools"
              >
                {renderNavLink(next, { nestedUnderTraining: true })}
              </div>
            </div>,
          );
          i += 1;
          continue;
        }
      }
      if (item.href === "/instructor/lesson-design-studio") {
        out.push(renderNavLink(item));
        continue;
      }
      out.push(renderNavLink(item));
    }
    return out;
  }

  return (
    <nav className="nav nav--minimal">
      <div className="nav-search-wrapper">
        <input
          ref={searchRef}
          type="text"
          className="nav-search"
          placeholder="Search navigation..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search navigation"
        />
        {!search ? <span className="nav-search-kbd">⌘K</span> : null}
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
            {studentHomeOnlyCore ? null : (
              <p className="nav-block-title">{useMinimalFlatNavChrome ? "Shortcuts" : "Top Tools"}</p>
            )}
            <div className="nav-main-items">{renderCoreNavItems()}</div>
          </section>

          {filteredMore.length > 0 ? (
            useMinimalFlatNavChrome ? (
              <section className="nav-student-flat-groups" aria-label="Navigation sections">
                {filteredMore.map((group) => {
                  const groupHasActive =
                    activeNavHref !== null && group.items.some((item) => item.href === activeNavHref);
                  const groupOpen = hasSearch
                    ? true
                    : (openGroups[group.label] ?? false) || groupHasActive;
                  const isLocked = lockedGroups?.has(group.label);
                  const lockReason = isLocked && lockedGroups ? lockedGroups.get(group.label) : undefined;
                  const isRecentlyUnlocked = recentlyUnlockedGroups?.has(group.label);
                  const heading = minimalGroupEmoji[group.label as NavGroup]
                    ? `${minimalGroupEmoji[group.label as NavGroup]} ${group.label}`
                    : group.label;

                  return (
                    <div key={group.label} className="nav-student-group">
                      <button
                        type="button"
                        className={`nav-more-group-toggle nav-student-flat-toggle ${groupHasActive ? "nav-section-active" : ""}${isLocked ? " nav-section-locked" : ""}`}
                        onClick={() => !isLocked && toggleGroup(group.label)}
                        aria-expanded={isLocked ? false : groupOpen}
                        aria-label={
                          isLocked
                            ? `${group.label} — locked: ${lockReason}`
                            : `${groupOpen ? "Collapse" : "Expand"} ${group.label}`
                        }
                        disabled={hasSearch || isLocked}
                        title={isLocked ? `Locked: ${lockReason}` : undefined}
                      >
                        <span className="nav-section-label">
                          {isLocked && <span className="nav-lock-icon" aria-hidden="true">{"🔒 "}</span>}
                          {heading}
                        </span>
                        {isRecentlyUnlocked ? <span className="nav-new-badge">New!</span> : null}
                        {!isLocked && (
                          <span className={`nav-section-chevron ${groupOpen ? "open" : ""}`}>{"›"}</span>
                        )}
                      </button>

                      {!isLocked && groupOpen ? (
                        <div className="nav-more-group-items">{group.items.map((item) => renderNavLink(item))}</div>
                      ) : null}
                      {isLocked ? (
                        <p className="nav-student-locked-hint">
                          {lockReason ?? "Complete earlier steps to unlock."}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ) : (
              <section className="nav-more">
                <button
                  type="button"
                  className="nav-more-toggle"
                  onClick={() => setMoreOpen((previous) => !previous)}
                  aria-expanded={effectiveMoreOpen}
                  aria-label={`${effectiveMoreOpen ? "Collapse" : "Expand"} more navigation links`}
                  disabled={hasSearch}
                >
                  <span className="nav-more-label">More Tools ({moreCountLabel})</span>
                  <span className={`nav-more-chevron ${effectiveMoreOpen ? "open" : ""}`}>{"›"}</span>
                </button>

                {effectiveMoreOpen ? (
                  <div className="nav-more-content">
                    {filteredMore.map((group) => {
                      const groupHasActive =
                        activeNavHref !== null && group.items.some((item) => item.href === activeNavHref);
                      const groupOpen = hasSearch
                        ? true
                        : (openGroups[group.label] ?? false) || groupHasActive;

                      const isLocked = lockedGroups?.has(group.label);
                      const lockReason = isLocked && lockedGroups ? lockedGroups.get(group.label) : undefined;
                      const isRecentlyUnlocked = recentlyUnlockedGroups?.has(group.label);

                      return (
                        <div key={group.label} className="nav-more-group">
                          <button
                            type="button"
                            className={`nav-more-group-toggle ${groupHasActive ? "nav-section-active" : ""}${isLocked ? " nav-section-locked" : ""}`}
                            onClick={() => !isLocked && toggleGroup(group.label)}
                            aria-expanded={isLocked ? false : groupOpen}
                            aria-label={`${isLocked ? `${group.label} — locked: ${lockReason}` : `${groupOpen ? "Collapse" : "Expand"} ${group.label}`}`}
                            disabled={hasSearch || isLocked}
                            title={isLocked ? `Locked: ${lockReason}` : undefined}
                          >
                            <span className="nav-section-label">
                              {isLocked && <span className="nav-lock-icon" aria-hidden="true">{"🔒 "}</span>}
                              {group.label}
                            </span>
                            {isRecentlyUnlocked && (
                              <span className="nav-new-badge">New!</span>
                            )}
                            {!isLocked && (
                              <span className={`nav-section-chevron ${groupOpen ? "open" : ""}`}>{"›"}</span>
                            )}
                          </button>

                          {!isLocked && groupOpen ? (
                            <div className="nav-more-group-items">{group.items.map((item) => renderNavLink(item))}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            )
          ) : null}
        </>
      )}
    </nav>
  );
}
