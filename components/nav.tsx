"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Key matching a badge count in NavBadges, e.g. "notifications" */
  badgeKey?: string;
}

interface NavSection {
  label: string;
  icon: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

/** Counts passed from the server layout for notification badges. */
export interface NavBadges {
  notifications?: number;
  messages?: number;
  approvals?: number;
}

// ---------------------------------------------------------------------------
// localStorage helpers (A1)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ypp-nav-sections";

function loadSavedState(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSectionState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Section builder
// ---------------------------------------------------------------------------

function buildSections(roles: string[], awardTier?: string): NavSection[] {
  const isAdmin = roles.includes("ADMIN");
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isParent = roles.includes("PARENT");
  const isInstructor = roles.includes("INSTRUCTOR");
  const isStudent = roles.includes("STUDENT");
  const isApplicant = roles.includes("STUDENT") || roles.includes("INSTRUCTOR") || roles.includes("STAFF");
  const hasAward = awardTier && ["BRONZE", "SILVER", "GOLD"].includes(awardTier);

  const sections: NavSection[] = [];

  // Parent Portal
  if (isParent) {
    sections.push({
      label: "Family",
      icon: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67",
      defaultOpen: true,
      items: [
        { href: "/parent", label: "Parent Portal", icon: "\uD83C\uDFE0" },
        { href: "/parent/resources", label: "Resources", icon: "\uD83D\uDCDA" },
      ],
    });
  }

  // Main
  sections.push({
    label: "Main",
    icon: "\u2302",
    defaultOpen: true,
    items: [
      { href: "/", label: "Overview", icon: "\u25A3" },
      { href: "/world", label: "Passion World", icon: "\uD83C\uDF0D" },
      { href: "/announcements", label: "Announcements", icon: "\uD83D\uDCE2" },
      { href: "/notifications", label: "Notifications", icon: "\uD83D\uDD14", badgeKey: "notifications" },
      { href: "/messages", label: "Messages", icon: "\u2709", badgeKey: "messages" },
      { href: "/feedback/anonymous", label: "Anonymous Feedback", icon: "\uD83D\uDCAC" },
    ],
  });

  // Learning
  const learningItems: NavItem[] = [
    { href: "/pathways", label: "Pathways", icon: "\uD83D\uDDFA" },
    { href: "/curriculum", label: "Courses", icon: "\uD83D\uDCD6" },
    { href: "/classes/catalog", label: "Class Catalog", icon: "\uD83D\uDCCB" },
  ];
  if (isStudent) {
    learningItems.push({ href: "/my-courses", label: "My Courses", icon: "\uD83C\uDF93" });
    learningItems.push({ href: "/classes/schedule", label: "My Schedule", icon: "\uD83D\uDCC5" });
    learningItems.push({ href: "/courses/recommended", label: "Recommended", icon: "\u2B50" });
    learningItems.push({ href: "/learn/modules", label: "Modules", icon: "\uD83D\uDCE6" });
    learningItems.push({ href: "/learn/workshops", label: "Workshops", icon: "\uD83D\uDD27" });
    learningItems.push({ href: "/learn/style-quiz", label: "Style Quiz", icon: "\uD83E\uDDE9" });
    learningItems.push({ href: "/learn/challenges", label: "Challenge Learning", icon: "\u26A1" });
    learningItems.push({ href: "/learn/practice", label: "Practice Log", icon: "\uD83C\uDFCB" });
    learningItems.push({ href: "/learn/progress", label: "My Progress", icon: "\uD83D\uDCC8" });
  }
  learningItems.push({ href: "/programs", label: "Programs", icon: "\uD83C\uDFAF" });
  sections.push({ label: "Learning", icon: "\uD83D\uDCD6", defaultOpen: true, items: learningItems });

  // Growth & Progress
  const growthItems: NavItem[] = [
    { href: "/goals", label: "My Goals", icon: "\uD83C\uDFAF" },
  ];
  if (isStudent) {
    growthItems.push({ href: "/analytics", label: "Analytics", icon: "\uD83D\uDCCA" });
    growthItems.push({ href: "/learn/path-generator", label: "Learning Paths", icon: "\uD83E\uDDED" });
    growthItems.push({ href: "/pathways/progress", label: "Pathway Progress", icon: "\uD83D\uDCC8" });
    growthItems.push({ href: "/projects/tracker", label: "Project Tracker", icon: "\uD83D\uDCDD" });
    growthItems.push({ href: "/motivation", label: "Motivation", icon: "\uD83D\uDD25" });
    growthItems.push({ href: "/reflections/streaks", label: "Reflection Streaks", icon: "\uD83D\uDD17" });
  }
  if (isInstructor || isChapterLead) {
    growthItems.push({ href: "/reflection", label: "Monthly Reflection", icon: "\uD83D\uDCDD" });
  }
  if (isInstructor || isAdmin || isChapterLead) {
    growthItems.push({ href: "/instructor-training", label: "Instructor Training", icon: "\uD83C\uDF93" });
    growthItems.push({ href: "/lesson-plans", label: "Lesson Plans", icon: "\uD83D\uDCCB" });
    growthItems.push({ href: "/instructor/lesson-plans/templates", label: "Plan Templates", icon: "\uD83D\uDCC4" });
    growthItems.push({ href: "/instructor/curriculum-builder", label: "Curriculum Builder", icon: "\uD83D\uDEE0" });
    growthItems.push({ href: "/instructor/class-settings", label: "Class Settings", icon: "\u2699" });
    growthItems.push({ href: "/instructor/training-progress", label: "Training Progress", icon: "\uD83D\uDCC8" });
    growthItems.push({ href: "/instructor/peer-observation", label: "Peer Observation", icon: "\uD83D\uDC41" });
    growthItems.push({ href: "/instructor/mentee-health", label: "Mentee Health", icon: "\uD83D\uDC9A" });
  }
  sections.push({ label: "Growth", icon: "\uD83C\uDF31", defaultOpen: false, items: growthItems });

  // Challenges & Achievements
  const challengeItems: NavItem[] = [
    { href: "/challenges", label: "Challenges", icon: "\u26A1" },
    { href: "/challenges/daily", label: "Daily Challenges", icon: "\uD83C\uDF1F" },
    { href: "/challenges/weekly", label: "Weekly Prompts", icon: "\uD83D\uDCDD" },
    { href: "/challenges/streaks", label: "Streaks", icon: "\uD83D\uDD25" },
    { href: "/challenges/nominate", label: "Nominate Challenge", icon: "\uD83D\uDC4D" },
    { href: "/challenges/passport", label: "Passion Passport", icon: "\uD83D\uDCD8" },
    { href: "/competitions", label: "Competitions", icon: "\uD83C\uDFC6" },
    { href: "/competitions/checklist", label: "Competition Checklist", icon: "\u2611" },
    { href: "/showcases", label: "Seasonal Events", icon: "\uD83C\uDF89" },
    { href: "/leaderboards", label: "Leaderboards", icon: "\uD83D\uDCCA" },
    { href: "/rewards", label: "Rewards", icon: "\uD83C\uDF81" },
    { href: "/achievements/badges", label: "Badge Gallery", icon: "\uD83C\uDFC5" },
    { href: "/student-of-month", label: "Student of the Month", icon: "\u2B50" },
    { href: "/wall-of-fame", label: "Wall of Fame", icon: "\uD83C\uDFDB" },
  ];
  sections.push({ label: "Challenges", icon: "\uD83C\uDFC6", defaultOpen: false, items: challengeItems });

  // Incubator & Projects
  const incubatorItems: NavItem[] = [
    { href: "/incubator", label: "Project Incubator", icon: "\uD83D\uDE80" },
    { href: "/incubator/apply", label: "Apply", icon: "\uD83D\uDCE9" },
    { href: "/projects/tracker", label: "My Projects", icon: "\uD83D\uDCCB" },
    { href: "/showcase", label: "Student Showcase", icon: "\uD83C\uDFA8" },
    { href: "/showcase/submit", label: "Share Your Work", icon: "\uD83D\uDCE4" },
  ];
  sections.push({ label: "Incubator", icon: "\uD83D\uDE80", defaultOpen: false, items: incubatorItems });

  // Opportunities
  const realWorldItems: NavItem[] = [
    { href: "/internships", label: "Opportunities", icon: "\uD83D\uDCBC" },
    { href: "/service-projects", label: "Service Projects", icon: "\uD83E\uDD1D" },
    { href: "/resource-exchange", label: "Resource Exchange", icon: "\uD83D\uDD04" },
    { href: "/portfolio/templates", label: "Portfolio Templates", icon: "\uD83D\uDCC2" },
    { href: "/events/map", label: "Chapter Events Map", icon: "\uD83D\uDDFA" },
  ];
  if (isApplicant || isAdmin) {
    realWorldItems.push(
      { href: "/positions", label: "Leadership/Instructor Openings", icon: "\uD83D\uDCCC" },
      { href: "/applications", label: "My Applications", icon: "\uD83D\uDCE8" },
    );
  }
  if (isInstructor || isAdmin) {
    realWorldItems.push({ href: "/instructor/certification-pathway", label: "Cert Pathway", icon: "\uD83D\uDCDC" });
  }
  sections.push({ label: "Opportunities", icon: "\uD83C\uDF10", defaultOpen: false, items: realWorldItems });

  // Community
  const communityItems: NavItem[] = [
    { href: "/mentorship", label: "Mentorship", icon: "\uD83E\uDD1D" },
  ];
  if (isMentor || isAdmin) {
    communityItems.push({ href: "/mentorship/mentees", label: "My Mentees", icon: "\uD83D\uDC65" });
  }
  if (isStudent) {
    communityItems.push({ href: "/my-mentor", label: "My Mentor", icon: "\uD83E\uDDD1\u200D\uD83C\uDFEB" });
  }
  communityItems.push(
    { href: "/events", label: "Events & Prep", icon: "\uD83D\uDCC5" },
    { href: "/calendar", label: "Calendar", icon: "\uD83D\uDDD3" },
  );
  communityItems.push({ href: "/office-hours", label: "Office Hours", icon: "\uD83D\uDD52" });
  if (isStudent) {
    communityItems.push({ href: "/check-in", label: "Check-In", icon: "\u2714" });
  }
  if (isMentor || isAdmin) {
    communityItems.push({ href: "/mentor/resources", label: "Mentor Resources", icon: "\uD83D\uDCDA" });
  }
  if (isInstructor || isAdmin || isChapterLead) {
    communityItems.push({ href: "/attendance", label: "Attendance", icon: "\uD83D\uDCCB" });
  }
  sections.push({ label: "Community", icon: "\uD83D\uDC65", defaultOpen: false, items: communityItems });

  // Chapters
  const chapterItems: NavItem[] = [
    { href: "/chapters", label: "Chapters", icon: "\uD83C\uDFE2" },
  ];
  if (isChapterLead) {
    chapterItems.push({ href: "/chapter", label: "My Chapter", icon: "\uD83C\uDFE0" });
    chapterItems.push({ href: "/chapter-lead/dashboard", label: "Chapter Dashboard", icon: "\uD83D\uDCCA" });
  }
  if (isApplicant || isAdmin) {
    chapterItems.push(
      { href: "/positions", label: "Open Positions", icon: "\uD83D\uDCCC" },
      { href: "/applications", label: "My Applications", icon: "\uD83D\uDCE8" },
    );
  }
  sections.push({ label: "Chapters", icon: "\uD83C\uDFE2", defaultOpen: false, items: chapterItems });

  // Account
  const achievementItems: NavItem[] = [
    { href: "/certificates", label: "My Certificates", icon: "\uD83D\uDCDC" },
  ];
  if (hasAward || isAdmin) {
    achievementItems.push(
      { href: "/alumni", label: "Alumni", icon: "\uD83C\uDF93" },
      { href: "/college-advisor", label: "College Advisor", icon: "\uD83E\uDDD1\u200D\uD83D\uDCBB" },
    );
  }
  achievementItems.push({ href: "/profile", label: "My Profile", icon: "\uD83D\uDC64" });
  achievementItems.push({ href: "/profile/timeline", label: "My Journey", icon: "\uD83D\uDEE4" });
  achievementItems.push({ href: "/profile/xp", label: "XP & Levels", icon: "\u2B06" });
  achievementItems.push({ href: "/profile/certifications", label: "Certifications", icon: "\uD83C\uDFC5" });
  achievementItems.push({ href: "/settings/personalization", label: "Personalization", icon: "\uD83C\uDFA8" });
  sections.push({ label: "Account", icon: "\uD83D\uDC64", defaultOpen: false, items: achievementItems });

  // -----------------------------------------------------------------------
  // Admin — sub-grouped (A3)
  // -----------------------------------------------------------------------
  if (isAdmin) {
    sections.push({
      label: "Admin: People",
      icon: "\uD83D\uDC65",
      defaultOpen: false,
      items: [
        { href: "/admin", label: "Dashboard", icon: "\uD83D\uDCCA" },
        { href: "/admin/students", label: "All Students", icon: "\uD83D\uDC68\u200D\uD83C\uDF93" },
        { href: "/admin/instructors", label: "All Instructors", icon: "\uD83D\uDC69\u200D\uD83C\uDFEB" },
        { href: "/admin/bulk-users", label: "Bulk Users", icon: "\uD83D\uDC65" },
        { href: "/admin/parent-approvals", label: "Parent Approvals", icon: "\u2714", badgeKey: "approvals" },
        { href: "/admin/instructor-readiness", label: "Instructor Readiness", icon: "\u2705" },
        { href: "/admin/staff", label: "Staff Reflections", icon: "\uD83D\uDCDD" },
        { href: "/admin/applications", label: "Applications", icon: "\uD83D\uDCCB" },
      ],
    });

    sections.push({
      label: "Admin: Content",
      icon: "\uD83D\uDCDD",
      defaultOpen: false,
      items: [
        { href: "/admin/announcements", label: "Announcements", icon: "\uD83D\uDCE2" },
        { href: "/admin/programs", label: "Programs", icon: "\uD83D\uDCE6" },
        { href: "/admin/training", label: "Training Modules", icon: "\uD83C\uDFEB" },
        { href: "/admin/goals", label: "Goals", icon: "\uD83C\uDFAF" },
        { href: "/admin/reflections", label: "Reflections", icon: "\uD83D\uDCAD" },
        { href: "/admin/reflection-forms", label: "Forms", icon: "\uD83D\uDCCB" },
        { href: "/admin/incubator", label: "Incubator Mgmt", icon: "\uD83D\uDE80" },
      ],
    });

    sections.push({
      label: "Admin: Reports",
      icon: "\uD83D\uDCCA",
      defaultOpen: false,
      items: [
        { href: "/admin/analytics", label: "Analytics", icon: "\uD83D\uDCC8" },
        { href: "/admin/chapter-reports", label: "Chapter Reports", icon: "\uD83D\uDCCA" },
        { href: "/admin/chapters", label: "All Chapters", icon: "\uD83C\uDFE2" },
        { href: "/admin/pathway-tracking", label: "Pathway Tracking", icon: "\uD83D\uDEE4" },
        { href: "/admin/audit-log", label: "Audit Log", icon: "\uD83D\uDDD2" },
        { href: "/admin/volunteer-hours", label: "Volunteer Hours", icon: "\u23F0" },
        { href: "/admin/export", label: "Data Export", icon: "\uD83D\uDCE5" },
        { href: "/admin/data-export", label: "Export Tools", icon: "\uD83D\uDCBE" },
      ],
    });

    sections.push({
      label: "Admin: Ops",
      icon: "\u2699",
      defaultOpen: false,
      items: [
        { href: "/admin/waitlist", label: "Waitlist", icon: "\u23F3" },
        { href: "/admin/reminders", label: "Reminders", icon: "\uD83D\uDD14" },
        { href: "/admin/emergency-broadcast", label: "Emergency Broadcast", icon: "\uD83D\uDEA8" },
        { href: "/admin/mentor-match", label: "Mentor Match", icon: "\uD83E\uDD1D" },
        { href: "/admin/alumni", label: "Alumni", icon: "\uD83C\uDF93" },
      ],
    });
  }

  return sections;
}

/** Check if any item in a section matches the current pathname */
function sectionHasActiveItem(section: NavSection, pathname: string): boolean {
  return section.items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href)),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Nav({
  roles = [],
  awardTier,
  badges,
  onNavigate,
}: {
  roles?: string[];
  awardTier?: string;
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = useMemo(() => buildSections(roles, awardTier), [roles, awardTier]);

  // A2: search filter state
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchLower = search.toLowerCase().trim();

  // A1: open/closed state — restore from localStorage, fall back to defaults
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const saved = loadSavedState();
    if (saved) return saved;
    const initial: Record<string, boolean> = {};
    for (const section of buildSections(roles, awardTier)) {
      initial[section.label] =
        section.defaultOpen === true || sectionHasActiveItem(section, pathname);
    }
    return initial;
  });

  // Persist to localStorage whenever open state changes (A1)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveSectionState(openSections);
  }, [openSections]);

  const toggleSection = useCallback((label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // A2: keyboard shortcut — Ctrl+K or / to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // A2: Filter sections/items by search
  const filteredSections = useMemo(() => {
    if (!searchLower) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(searchLower) ||
            item.href.toLowerCase().includes(searchLower),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, searchLower]);

  return (
    <nav className="nav">
      {/* A2: Search input */}
      <div className="nav-search-wrapper">
        <input
          ref={searchRef}
          type="text"
          className="nav-search"
          placeholder="Search nav... (Ctrl+K)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search navigation"
        />
        {search && (
          <button
            type="button"
            className="nav-search-clear"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            {"\u2715"}
          </button>
        )}
      </div>

      {filteredSections.map((section) => {
        // While searching, always expand matching sections
        const isOpen = searchLower
          ? true
          : (openSections[section.label] ?? false);
        const hasActive = sectionHasActiveItem(section, pathname);

        return (
          <div key={section.label} className="nav-section">
            <button
              type="button"
              className={`nav-section-toggle ${hasActive ? "nav-section-active" : ""}`}
              onClick={() => toggleSection(section.label)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${section.label}`}
            >
              <span className="nav-section-icon">{section.icon}</span>
              <span className="nav-section-label">{section.label}</span>
              <span className={`nav-section-chevron ${isOpen ? "open" : ""}`}>
                {"\u203A"}
              </span>
            </button>
            {isOpen && (
              <div className="nav-section-items">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));

                  // A4: badge count
                  const badgeCount = item.badgeKey && badges
                    ? badges[item.badgeKey as keyof NavBadges]
                    : undefined;

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
                        <span className="nav-badge">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {searchLower && filteredSections.length === 0 && (
        <div className="nav-empty">No results for &ldquo;{search}&rdquo;</div>
      )}
    </nav>
  );
}
