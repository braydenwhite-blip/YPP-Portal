"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HelpAgentTrigger } from "@/components/help-agent/help-agent-provider";
import { SidebarRecents } from "@/components/help-agent/sidebar-recents";
import {
  cn,
  SidebarChevron,
  sidebarBadgeClass,
  sidebarFilterInputClass,
  sidebarGroupToggleVariants,
  sidebarIconVariants,
  sidebarLinkVariants,
  sidebarNavPanelClass,
  sidebarNewBadgeClass,
  sidebarSectionDividerClass,
  sidebarSectionTitleClass,
} from "@/components/ui-v2";
import { resolveNavActiveHref, resolveNavModel } from "@/lib/navigation/resolve-nav";
import { INSTRUCTOR_MINIMAL_GROUP_EMOJI } from "@/lib/navigation/instructor-v1-nav-layout";
import { STUDENT_MINIMAL_GROUP_EMOJI } from "@/lib/navigation/student-v1-nav-layout";
import { CHAPTER_PRESIDENT_MINIMAL_GROUP_EMOJI } from "@/lib/navigation/chapter-president-v1-nav-layout";
import { OFFICER_GROUP_EMOJI, OFFICER_PRIMARY_GROUPS } from "@/lib/navigation/officer-nav-layout";
import type { NavGroup, NavLink } from "@/lib/navigation/types";

/**
 * Sidebar navigation — all nine roles, one chrome (Knowledge OS V2).
 *
 * Behavior (nav model resolution, group expand/collapse with localStorage
 * persistence, role-minimal chrome, locking, badges, the filter input) is
 * unchanged from the legacy version and pinned by
 * tests/components/app-shell-nav-contract.test.tsx. The skin is the light
 * cream sidebar with bubbly pill links from components/ui-v2/sidebar.
 */

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
  actionTrackerEnabled,
  growthOsEnabled,
  operationsHubEnabled,
  legacyActionCenterNavEnabled,
  onNavigate,
  unlockedSections,
  recentlyUnlockedGroups,
  lockedGroups: lockedGroupsProp,
  studentFullPortalExplorer,
  studentHasChapter,
  instructorFullPortalExplorer,
  hiringDemoMode,
  instructorSubtype,
  publicGateActive,
  officerTier,
}: {
  roles?: string[];
  adminSubtypes?: string[];
  primaryRole?: string | null;
  awardTier?: string;
  badges?: NavBadges;
  enabledFeatureKeys?: Set<string>;
  /** People Strategy Action Tracker enabled (env ENABLE_ACTION_TRACKER). */
  actionTrackerEnabled?: boolean;
  /** Student Operating System / Growth Engine enabled (env ENABLE_GROWTH_OS). */
  growthOsEnabled?: boolean;
  /** People Strategy Operations Hub enabled (env ENABLE_OPERATIONS_HUB). */
  operationsHubEnabled?: boolean;
  /** Deprecated Leadership Action Center nav entry enabled. */
  legacyActionCenterNavEnabled?: boolean;
  onNavigate?: () => void;
  unlockedSections?: Set<string>;
  recentlyUnlockedGroups?: Set<string>;
  lockedGroups?: Map<string, string>;
  studentFullPortalExplorer?: boolean;
  /** When true, "Join a chapter" is hidden (user already has a chapter). */
  studentHasChapter?: boolean;
  instructorFullPortalExplorer?: boolean;
  hiringDemoMode?: boolean;
  /** SUMMER_WORKSHOP keeps the workshop studio + training links visible. */
  instructorSubtype?: string | null;
  /** Public portal gate is active for this user (no admin/preview bypass). */
  publicGateActive?: boolean;
  /** Officer tier (from AppShell) — gates the Recently Viewed section. */
  officerTier?: boolean;
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
        actionTrackerEnabled,
        growthOsEnabled,
        operationsHubEnabled,
        legacyActionCenterNavEnabled,
        unlockedSections,
        studentFullPortalExplorer,
        studentHasChapter,
        instructorFullPortalExplorer,
        hiringDemoMode,
        instructorSubtype,
        publicGateActive,
      }),
    [
      adminSubtypes,
      awardTier,
      enabledFeatureKeys,
      actionTrackerEnabled,
      growthOsEnabled,
      operationsHubEnabled,
      legacyActionCenterNavEnabled,
      pathname,
      primaryRole,
      roles,
      unlockedSections,
      studentFullPortalExplorer,
      studentHasChapter,
      instructorFullPortalExplorer,
      hiringDemoMode,
      instructorSubtype,
      publicGateActive,
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
    // Officers get every operating-system section open by default, so the whole
    // nav is visible at a glance instead of hidden behind collapsed headers.
    const officerChrome = model.officerChrome === true;
    for (const group of model.more) {
      next[group.label] =
        (officerChrome && OFFICER_PRIMARY_GROUPS.has(group.label as NavGroup)) ||
        (activeNavHref !== null && group.items.some((item) => item.href === activeNavHref));
    }
    return next;
  }, [model.more, activeNavHref, model.officerChrome]);

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
      const officerChrome = model.officerChrome === true;

      for (const group of model.more) {
        if (next[group.label] === undefined) {
          next[group.label] =
            (officerChrome && OFFICER_PRIMARY_GROUPS.has(group.label as NavGroup)) ||
            (activeNavHref !== null && group.items.some((item) => item.href === activeNavHref));
        }
      }

      for (const label of Object.keys(next)) {
        if (!model.more.some((group) => group.label === label)) {
          delete next[label];
        }
      }

      return next;
    });
  }, [model.more, activeNavHref, model.officerChrome]);

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

  // ⌘K belongs to the YPP Help Agent (global palette) — see
  // components/help-agent/help-agent-provider.tsx. The nav filter below stays
  // a plain click-to-focus input.
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
  const showSearch = hiringDemoMode !== true;

  const showStudentMinimalChrome =
    model.primaryRole === "STUDENT" && studentFullPortalExplorer !== true;
  const showInstructorMinimalChrome =
    model.primaryRole === "INSTRUCTOR" && instructorFullPortalExplorer !== true;
  const showChapterPresidentMinimalChrome = model.primaryRole === "CHAPTER_PRESIDENT";
  const useMinimalFlatNavChrome =
    showStudentMinimalChrome || showInstructorMinimalChrome || showChapterPresidentMinimalChrome;
  // Officers get the leadership operating-system chrome: always-visible,
  // collapsible sections (Command / Work / People / Programs / Partners / Data /
  // Admin) instead of one big "More Tools" accordion — so every area is one
  // glance away. They keep the "Top Tools" pins and Recently Viewed.
  const showOfficerChrome = model.officerChrome === true;
  const useFlatGroupChrome = useMinimalFlatNavChrome || showOfficerChrome;
  const flatGroupEmoji = showOfficerChrome
    ? OFFICER_GROUP_EMOJI
    : model.primaryRole === "INSTRUCTOR"
      ? INSTRUCTOR_MINIMAL_GROUP_EMOJI
      : model.primaryRole === "CHAPTER_PRESIDENT"
        ? CHAPTER_PRESIDENT_MINIMAL_GROUP_EMOJI
        : STUDENT_MINIMAL_GROUP_EMOJI;
  const studentHomeOnlyCore =
    showStudentMinimalChrome &&
    filteredCore.length === 1 &&
    filteredCore[0]?.href === "/";

  const hasSearch = searchLower.length > 0;
  const effectiveMoreOpen = hasSearch ? true : moreOpen;
  const hiddenCount = model.more.reduce((sum, group) => sum + group.items.length, 0);
  const moreCountLabel = hasSearch ? totalMore : hiddenCount;

  // Recently Viewed: leadership chrome only — never on the role-minimal navs,
  // never in hiring demo, never behind the public gate, hidden while filtering.
  const showRecents =
    officerTier === true &&
    !useMinimalFlatNavChrome &&
    showSearch &&
    publicGateActive !== true &&
    !hasSearch;

  const renderNavLink = (item: NavLink, opts?: { nestedUnderTraining?: boolean }): JSX.Element => {
    const isActive = activeNavHref !== null && item.href === activeNavHref;
    const badgeCount = item.badgeKey && badges ? badges[item.badgeKey] : undefined;
    const nested = opts?.nestedUnderTraining === true;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(sidebarLinkVariants({ active: isActive, nested }))}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
      >
        <span aria-hidden className={cn(sidebarIconVariants({ active: isActive, nested }))}>
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {badgeCount && badgeCount > 0 ? (
          <span className={sidebarBadgeClass}>{badgeCount > 99 ? "99+" : badgeCount}</span>
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
            <div key="instructor-training-with-studio" className="flex flex-col gap-0.5">
              {renderNavLink(item)}
              <div
                className="mb-1 ml-5 flex flex-col gap-0.5 border-l-2 border-[rgba(99,102,241,0.2)] pl-2"
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
    <nav className="flex flex-col gap-3">
      {/* Doorway to every page in the portal. Gated behind the public preview
          gate: it only appears once the viewer is past the gate (a valid
          preview passcode, an officer bypass, or the gate disabled entirely) —
          mirroring middleware, which redirects gated users away from /site-map.
          So "see everything" is reachable then and only then. */}
      {publicGateActive !== true ? (
        <Link
          href="/site-map"
          onClick={onNavigate}
          aria-current={activeNavHref === "/site-map" ? "page" : undefined}
          className="mb-1 flex items-center gap-2 rounded-xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] px-3 py-2.5 text-[13.5px] font-semibold text-[#4f46e5] no-underline transition-colors hover:bg-[rgba(99,102,241,0.14)]"
        >
          <span aria-hidden className="text-base leading-none">
            {"🗺️"}
          </span>
          <span className="min-w-0 flex-1 truncate">Full Portal — see everything</span>
        </Link>
      ) : null}
      {showSearch ? <HelpAgentTrigger className="mb-1" /> : null}
      {showSearch ? (
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            className={sidebarFilterInputClass}
            placeholder="Filter navigation..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Filter navigation"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              {"✕"}
            </button>
          )}
        </div>
      ) : null}

      {totalResults === 0 ? (
        <div className="px-3 py-4 text-[12.5px] text-[var(--gray-600)]">
          No results for &ldquo;{search}&rdquo;
        </div>
      ) : (
        <>
          <section className={sidebarNavPanelClass}>
            {studentHomeOnlyCore ? null : (
              <p className={sidebarSectionTitleClass}>
                {hiringDemoMode ? "Hiring" : useMinimalFlatNavChrome ? "Shortcuts" : "Top Tools"}
              </p>
            )}
            <div className="flex flex-col gap-0.5 p-2">{renderCoreNavItems()}</div>
          </section>

          {filteredMore.length > 0 ? (
            useFlatGroupChrome ? (
              <section className="flex flex-col gap-1" aria-label="Navigation sections">
                {filteredMore.map((group) => {
                  const groupHasActive =
                    activeNavHref !== null && group.items.some((item) => item.href === activeNavHref);
                  const groupOpen = hasSearch
                    ? true
                    : (openGroups[group.label] ?? false) || groupHasActive;
                  const isLocked = lockedGroups?.has(group.label);
                  const lockReason = isLocked && lockedGroups ? lockedGroups.get(group.label) : undefined;
                  const isRecentlyUnlocked = recentlyUnlockedGroups?.has(group.label);
                  const heading = flatGroupEmoji[group.label as NavGroup]
                    ? `${flatGroupEmoji[group.label as NavGroup]} ${group.label}`
                    : group.label;

                  return (
                    <div key={group.label}>
                      <button
                        type="button"
                        className={cn(
                          sidebarGroupToggleVariants({
                            active: groupHasActive,
                            open: groupOpen,
                            locked: Boolean(isLocked),
                          })
                        )}
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
                        <span className="min-w-0 flex-1 truncate normal-case tracking-normal">
                          {isLocked && <span aria-hidden="true">{"🔒 "}</span>}
                          {heading}
                        </span>
                        {isRecentlyUnlocked ? (
                          <span className={sidebarNewBadgeClass}>New!</span>
                        ) : null}
                        {!isLocked && <SidebarChevron open={groupOpen} />}
                      </button>

                      {!isLocked && groupOpen ? (
                        <div className="flex flex-col gap-0.5 pb-1">
                          {group.items.map((item) => renderNavLink(item))}
                        </div>
                      ) : null}
                      {isLocked ? (
                        <p className="m-0 px-3 pb-2 text-[12px] leading-snug text-[var(--gray-600)]">
                          {lockReason ?? "Complete earlier steps to unlock."}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ) : (
              <section className={sidebarNavPanelClass}>
                <button
                  type="button"
                  className={cn(
                    sidebarGroupToggleVariants({
                      active: false,
                      open: effectiveMoreOpen,
                    }),
                    "border-b border-[rgba(99,102,241,0.1)]"
                  )}
                  onClick={() => setMoreOpen((previous) => !previous)}
                  aria-expanded={effectiveMoreOpen}
                  aria-label={`${effectiveMoreOpen ? "Collapse" : "Expand"} more navigation links`}
                  disabled={hasSearch}
                >
                  <span className="min-w-0 flex-1 truncate">More Tools ({moreCountLabel})</span>
                  <SidebarChevron open={effectiveMoreOpen} />
                </button>

                {effectiveMoreOpen ? (
                  <div className="ml-1 flex flex-col gap-0.5 border-l border-[rgba(99,102,241,0.1)] pl-2 pt-0.5 pb-2">
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
                        <div key={group.label}>
                          <button
                            type="button"
                            className={cn(
                              sidebarGroupToggleVariants({
                                active: groupHasActive,
                                open: groupOpen,
                                locked: Boolean(isLocked),
                              })
                            )}
                            onClick={() => !isLocked && toggleGroup(group.label)}
                            aria-expanded={isLocked ? false : groupOpen}
                            aria-label={`${isLocked ? `${group.label} — locked: ${lockReason}` : `${groupOpen ? "Collapse" : "Expand"} ${group.label}`}`}
                            disabled={hasSearch || isLocked}
                            title={isLocked ? `Locked: ${lockReason}` : undefined}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {isLocked && <span aria-hidden="true">{"🔒 "}</span>}
                              {group.label}
                            </span>
                            {isRecentlyUnlocked && (
                              <span className={sidebarNewBadgeClass}>New!</span>
                            )}
                            {!isLocked && <SidebarChevron open={groupOpen} />}
                          </button>

                          {!isLocked && groupOpen ? (
                            <div className="flex flex-col gap-0.5 pb-1">
                              {group.items.map((item) => renderNavLink(item))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            )
          ) : null}

          {showRecents ? <SidebarRecents /> : null}
        </>
      )}
    </nav>
  );
}
