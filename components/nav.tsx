"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

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

  // Parent Portal (if applicable)
  if (isParent) {
    sections.push({
      label: "Family",
      items: [{ href: "/parent", label: "Parent Portal", icon: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67" }]
    });
  }

  // Main section
  sections.push({
    label: "Main",
    items: [
      { href: "/", label: "Overview", icon: "\u25CB" },
      { href: "/announcements", label: "Announcements", icon: "\u25CB" },
      { href: "/notifications", label: "Notifications", icon: "\u25CB" },
      { href: "/messages", label: "Messages", icon: "\u25CB" }
    ]
  });

  // Learning
  const learningItems: NavItem[] = [
    { href: "/pathways", label: "Pathways", icon: "\u25CB" },
    { href: "/curriculum", label: "Courses", icon: "\u25CB" },
    { href: "/classes/catalog", label: "Class Catalog", icon: "\u25CB" }
  ];
  if (isStudent) {
    learningItems.push({ href: "/my-courses", label: "My Courses", icon: "\u25CB" });
    learningItems.push({ href: "/classes/schedule", label: "My Schedule", icon: "\u25CB" });
  }
  learningItems.push({ href: "/programs", label: "Programs", icon: "\u25CB" });
  sections.push({ label: "Learning", items: learningItems });

  // Growth & Progress
  const growthItems: NavItem[] = [
    { href: "/goals", label: "My Goals", icon: "\u25CB" }
  ];
  if (isStudent) {
    growthItems.push({ href: "/analytics", label: "Analytics", icon: "\u25CB" });
    growthItems.push({ href: "/learn/path-generator", label: "Learning Paths", icon: "\u25CB" });
  }
  if (isInstructor || isChapterLead) {
    growthItems.push({ href: "/reflection", label: "Monthly Reflection", icon: "\u25CB" });
  }
  if (isInstructor || isAdmin || isChapterLead) {
    growthItems.push({ href: "/instructor-training", label: "Instructor Training", icon: "\u25CB" });
    growthItems.push({ href: "/lesson-plans", label: "Lesson Plans", icon: "\u25CB" });
    growthItems.push({ href: "/instructor/curriculum-builder", label: "Curriculum Builder", icon: "\u25CB" });
  }
  sections.push({ label: "Growth", items: growthItems });

  // Challenges & Achievements
  const challengeItems: NavItem[] = [
    { href: "/challenges", label: "Challenges", icon: "\u25CB" },
    { href: "/challenges/weekly", label: "Weekly Prompts", icon: "\u25CB" },
    { href: "/challenges/passport", label: "Passion Passport", icon: "\u25CB" },
    { href: "/competitions", label: "Competitions", icon: "\u25CB" },
    { href: "/achievements/badges", label: "Badge Gallery", icon: "\u25CB" }
  ];
  sections.push({ label: "Challenges", items: challengeItems });

  // Community
  const communityItems: NavItem[] = [
    { href: "/mentorship", label: "Mentorship", icon: "\u25CB" }
  ];
  if (isMentor || isAdmin) {
    communityItems.push({ href: "/mentorship/mentees", label: "My Mentees", icon: "\u25CB" });
  }
  if (isStudent) {
    communityItems.push({ href: "/my-mentor", label: "My Mentor", icon: "\u25CB" });
  }
  communityItems.push(
    { href: "/events", label: "Events & Prep", icon: "\u25CB" },
    { href: "/calendar", label: "Calendar", icon: "\u25CB" }
  );
  if (isInstructor || isAdmin || isChapterLead) {
    communityItems.push({ href: "/attendance", label: "Attendance", icon: "\u25CB" });
  }
  sections.push({ label: "Community", items: communityItems });

  // Chapters
  const chapterItems: NavItem[] = [
    { href: "/chapters", label: "Chapters", icon: "\u25CB" }
  ];
  if (isChapterLead) {
    chapterItems.push({ href: "/chapter", label: "My Chapter", icon: "\u25CB" });
  }
  if (isApplicant || isAdmin) {
    chapterItems.push(
      { href: "/positions", label: "Open Positions", icon: "\u25CB" },
      { href: "/applications", label: "My Applications", icon: "\u25CB" }
    );
  }
  sections.push({ label: "Chapters", items: chapterItems });

  // Achievements
  const achievementItems: NavItem[] = [
    { href: "/certificates", label: "My Certificates", icon: "\u25CB" }
  ];
  if (hasAward || isAdmin) {
    achievementItems.push(
      { href: "/alumni", label: "Alumni", icon: "\u25CB" },
      { href: "/college-advisor", label: "College Advisor", icon: "\u25CB" }
    );
  }
  achievementItems.push({ href: "/profile", label: "My Profile", icon: "\u25CB" });
  sections.push({ label: "Account", items: achievementItems });

  // Admin
  if (isAdmin) {
    sections.push({
      label: "Admin",
      items: [
        { href: "/admin", label: "Dashboard", icon: "\u25CB" },
        { href: "/admin/announcements", label: "Announcements", icon: "\u25CB" },
        { href: "/admin/instructors", label: "All Instructors", icon: "\u25CB" },
        { href: "/admin/students", label: "All Students", icon: "\u25CB" },
        { href: "/admin/chapters", label: "All Chapters", icon: "\u25CB" },
        { href: "/admin/staff", label: "Staff Reflections", icon: "\u25CB" },
        { href: "/admin/goals", label: "Goals", icon: "\u25CB" },
        { href: "/admin/reflections", label: "Reflections", icon: "\u25CB" },
        { href: "/admin/reflection-forms", label: "Forms", icon: "\u25CB" },
        { href: "/admin/programs", label: "Programs", icon: "\u25CB" },
        { href: "/admin/alumni", label: "Alumni", icon: "\u25CB" },
        { href: "/admin/training", label: "Training Modules", icon: "\u25CB" },
        { href: "/admin/mentor-match", label: "Mentor Match", icon: "\u25CB" },
        { href: "/admin/analytics", label: "Analytics", icon: "\u25CB" },
        { href: "/admin/audit-log", label: "Audit Log", icon: "\u25CB" },
        { href: "/admin/waitlist", label: "Waitlist", icon: "\u25CB" },
        { href: "/admin/instructor-readiness", label: "Instructor Readiness", icon: "\u25CB" },
        { href: "/admin/export", label: "Data Export", icon: "\u25CB" },
        { href: "/admin/parent-approvals", label: "Parent Approvals", icon: "\u25CB" }
      ]
    });
  }

  return sections;
}

export default function Nav({
  roles = [],
  awardTier,
  onNavigate
}: {
  roles?: string[];
  awardTier?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = buildSections(roles, awardTier);

  return (
    <nav className="nav">
      {sections.map((section) => (
        <div key={section.label} className="nav-section">
          <div className="nav-section-label">{section.label}</div>
          {section.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "active" : undefined}
                onClick={onNavigate}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
