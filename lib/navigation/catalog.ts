import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

type CatalogInput = Omit<NavLink, "group" | "priority" | "coreEligible"> & {
  coreEligible?: boolean;
};

const INSTRUCTOR_ROLES: NavRole[] = ["INSTRUCTOR", "ADMIN", "CHAPTER_LEAD"];
const MENTOR_ROLES: NavRole[] = ["MENTOR", "CHAPTER_LEAD", "ADMIN"];
const APPLICANT_ROLES: NavRole[] = ["STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"];
const ADMIN_ONLY: NavRole[] = ["ADMIN"];
const PARENT_ONLY: NavRole[] = ["PARENT"];
const STUDENT_ONLY: NavRole[] = ["STUDENT"];
const CHAPTER_LEAD_ONLY: NavRole[] = ["CHAPTER_LEAD"];

function groupLinks(group: NavGroup, basePriority: number, links: CatalogInput[]): NavLink[] {
  return links.map((link, index) => ({
    ...link,
    group,
    priority: basePriority + index,
    coreEligible: link.coreEligible ?? true,
  }));
}

export const NAV_CATALOG: NavLink[] = [
  ...groupLinks("Family", 100, [
    {
      href: "/parent",
      label: "Parent Portal",
      icon: "🏠",
      roles: PARENT_ONLY,
      dashboardDescription: "View your linked students and progress signals.",
      dashboardPriority: 3,
    },
    {
      href: "/parent/resources",
      label: "Resources",
      icon: "📚",
      roles: PARENT_ONLY,
      dashboardDescription: "Access parent guidance and support resources.",
      dashboardPriority: 12,
    },
  ]),

  ...groupLinks("Main", 200, [
    {
      href: "/",
      label: "Overview",
      icon: "▣",
      dashboardDescription: "Your primary-role command center with queues and next actions.",
      dashboardPriority: 1,
    },
    {
      href: "/world",
      label: "Passion World",
      icon: "🌍",
      dashboardDescription: "Explore islands, progress, and passion-linked opportunities.",
      dashboardPriority: 40,
    },
    {
      href: "/announcements",
      label: "Announcements",
      icon: "📢",
      dashboardDescription: "Read chapter and platform updates.",
      dashboardPriority: 25,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "🔔",
      badgeKey: "notifications",
      dashboardBadgeKey: "unread_notifications",
      dashboardDescription: "Review unread alerts and updates.",
      dashboardPriority: 10,
    },
    {
      href: "/messages",
      label: "Messages",
      icon: "✉",
      badgeKey: "messages",
      dashboardBadgeKey: "unread_messages",
      dashboardDescription: "Open direct messages and team conversations.",
      dashboardPriority: 9,
    },
    { href: "/feedback/anonymous", label: "Anonymous Feedback", icon: "💬" },
  ]),

  ...groupLinks("Learning", 300, [
    { href: "/pathways", label: "Pathways", icon: "🗺" },
    { href: "/curriculum", label: "Courses", icon: "📖" },
    { href: "/classes/catalog", label: "Class Catalog", icon: "📋" },
    { href: "/my-courses", label: "My Courses", icon: "🎓", roles: STUDENT_ONLY },
    { href: "/classes/schedule", label: "My Schedule", icon: "📅", roles: STUDENT_ONLY },
    { href: "/courses/recommended", label: "Recommended", icon: "⭐", roles: STUDENT_ONLY },
    { href: "/learn/modules", label: "Modules", icon: "📦", roles: STUDENT_ONLY },
    { href: "/learn/workshops", label: "Workshops", icon: "🔧", roles: STUDENT_ONLY },
    { href: "/learn/style-quiz", label: "Style Quiz", icon: "🧩", roles: STUDENT_ONLY },
    { href: "/learn/challenges", label: "Challenge Learning", icon: "⚡", roles: STUDENT_ONLY },
    { href: "/learn/practice", label: "Practice Log", icon: "🏋", roles: STUDENT_ONLY },
    { href: "/learn/progress", label: "My Progress", icon: "📈", roles: STUDENT_ONLY },
    { href: "/programs", label: "Programs", icon: "🎯" },
  ]),

  ...groupLinks("Growth", 400, [
    {
      href: "/goals",
      label: "My Goals",
      icon: "🎯",
      dashboardDescription: "Track progress against your active goals.",
      dashboardPriority: 12,
    },
    { href: "/analytics", label: "Analytics", icon: "📊", roles: STUDENT_ONLY },
    { href: "/learn/path-generator", label: "Learning Paths", icon: "🧭", roles: STUDENT_ONLY },
    { href: "/pathways/progress", label: "Pathway Progress", icon: "📈", roles: STUDENT_ONLY },
    {
      href: "/projects/tracker",
      label: "Project Tracker",
      icon: "📝",
      roles: STUDENT_ONLY,
      searchAliases: ["My Projects"],
    },
    { href: "/motivation", label: "Motivation", icon: "🔥", roles: STUDENT_ONLY },
    { href: "/reflections/streaks", label: "Reflection Streaks", icon: "🔗", roles: STUDENT_ONLY },
    {
      href: "/reflection",
      label: "Monthly Reflection",
      icon: "📝",
      roles: ["INSTRUCTOR", "CHAPTER_LEAD"],
    },
    {
      href: "/instructor-training",
      label: "Instructor Training",
      icon: "🎓",
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Complete academy modules, interview readiness, and approvals.",
      dashboardPriority: 4,
      dashboardBadgeKey: "training_incomplete",
    },
    {
      href: "/lesson-plans",
      label: "Lesson Plans",
      icon: "📋",
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Draft and refine lesson plans for upcoming sessions.",
      dashboardPriority: 18,
    },
    {
      href: "/instructor/lesson-plans/templates",
      label: "Plan Templates",
      icon: "📄",
      roles: INSTRUCTOR_ROLES,
    },
    {
      href: "/instructor/curriculum-builder",
      label: "Curriculum Builder",
      icon: "🛠",
      roles: INSTRUCTOR_ROLES,
    },
    {
      href: "/instructor/class-settings",
      label: "Class Settings",
      icon: "⚙",
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Manage class offerings, schedules, and publish settings.",
      dashboardPriority: 3,
    },
    {
      href: "/instructor/peer-observation",
      label: "Peer Observation",
      icon: "👁",
      roles: INSTRUCTOR_ROLES,
    },
    {
      href: "/instructor/mentee-health",
      label: "Mentee Health",
      icon: "💚",
      roles: INSTRUCTOR_ROLES,
    },
  ]),

  ...groupLinks("Challenges", 500, [
    { href: "/challenges", label: "Challenges", icon: "⚡" },
    { href: "/challenges/daily", label: "Daily Challenges", icon: "🌟" },
    { href: "/challenges/weekly", label: "Weekly Prompts", icon: "📝" },
    { href: "/challenges/streaks", label: "Streaks", icon: "🔥" },
    { href: "/challenges/nominate", label: "Nominate Challenge", icon: "👍" },
    { href: "/challenges/passport", label: "Passion Passport", icon: "📘" },
    { href: "/competitions", label: "Competitions", icon: "🏆" },
    { href: "/competitions/checklist", label: "Competition Checklist", icon: "☑" },
    { href: "/showcases", label: "Seasonal Events", icon: "🎉" },
    { href: "/leaderboards", label: "Leaderboards", icon: "📊" },
    { href: "/rewards", label: "Rewards", icon: "🎁" },
    { href: "/achievements/badges", label: "Badge Gallery", icon: "🏅" },
    { href: "/student-of-month", label: "Student of the Month", icon: "⭐" },
    { href: "/wall-of-fame", label: "Wall of Fame", icon: "🏛" },
  ]),

  ...groupLinks("Incubator", 600, [
    { href: "/incubator", label: "Project Incubator", icon: "🚀" },
    { href: "/incubator/apply", label: "Apply", icon: "📩" },
    { href: "/showcase", label: "Student Showcase", icon: "🎨" },
    { href: "/showcase/submit", label: "Share Your Work", icon: "📤" },
  ]),

  ...groupLinks("Opportunities", 700, [
    { href: "/internships", label: "Opportunities", icon: "💼" },
    { href: "/service-projects", label: "Service Projects", icon: "🤝" },
    { href: "/resource-exchange", label: "Resource Exchange", icon: "🔄" },
    { href: "/portfolio/templates", label: "Portfolio Templates", icon: "📂" },
    { href: "/events/map", label: "Chapter Events Map", icon: "🗺" },
    {
      href: "/positions",
      label: "Open Positions",
      icon: "📌",
      roles: APPLICANT_ROLES,
      searchAliases: ["Leadership/Instructor Openings"],
      dashboardDescription: "Browse active hiring openings and role details.",
      dashboardPriority: 14,
    },
    {
      href: "/applications",
      label: "My Applications",
      icon: "📨",
      roles: APPLICANT_ROLES,
      dashboardDescription: "Track your submitted applications and interview status.",
      dashboardPriority: 8,
      dashboardBadgeKey: "active_applications",
    },
    {
      href: "/instructor/certification-pathway",
      label: "Cert Pathway",
      icon: "📜",
      roles: ["INSTRUCTOR", "ADMIN"],
    },
  ]),

  ...groupLinks("Community", 800, [
    {
      href: "/mentorship",
      label: "Mentorship",
      icon: "🤝",
      dashboardDescription: "Open mentorship activity, assignments, and support history.",
      dashboardPriority: 16,
    },
    {
      href: "/mentorship/mentees",
      label: "My Mentees",
      icon: "👥",
      roles: MENTOR_ROLES,
      dashboardDescription: "Review mentee progress and follow-up needs.",
      dashboardPriority: 5,
      dashboardBadgeKey: "active_mentees",
    },
    { href: "/my-mentor", label: "My Mentor", icon: "🧑‍🏫", roles: STUDENT_ONLY },
    { href: "/events", label: "Events & Prep", icon: "📅" },
    { href: "/calendar", label: "Calendar", icon: "🗓" },
    {
      href: "/office-hours",
      label: "Office Hours",
      icon: "🕒",
      dashboardDescription: "Host or book office hours support sessions.",
      dashboardPriority: 20,
    },
    { href: "/check-in", label: "Check-In", icon: "✔", roles: STUDENT_ONLY },
    { href: "/mentor/resources", label: "Mentor Resources", icon: "📚", roles: MENTOR_ROLES },
    {
      href: "/attendance",
      label: "Attendance",
      icon: "📋",
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Record and review class attendance sessions.",
      dashboardPriority: 11,
    },
  ]),

  ...groupLinks("Chapters", 900, [
    {
      href: "/chapters",
      label: "Chapters",
      icon: "🏢",
      dashboardDescription: "View chapter network details and updates.",
      dashboardPriority: 26,
    },
    {
      href: "/chapter",
      label: "My Chapter",
      icon: "🏠",
      roles: CHAPTER_LEAD_ONLY,
      dashboardDescription: "Open chapter performance, members, and operations.",
      dashboardPriority: 6,
    },
    {
      href: "/chapter/recruiting",
      label: "Chapter Recruiting",
      icon: "🧑‍💼",
      roles: CHAPTER_LEAD_ONLY,
      dashboardDescription: "Manage openings, candidates, interviews, and decisions.",
      dashboardPriority: 2,
      dashboardBadgeKey: "chapter_recruiting_queue",
    },
    {
      href: "/chapter-lead/dashboard",
      label: "Chapter Dashboard",
      icon: "📊",
      roles: CHAPTER_LEAD_ONLY,
      dashboardDescription: "Review chapter-wide KPIs and activity.",
      dashboardPriority: 15,
    },
    {
      href: "/chapter-lead/instructor-readiness",
      label: "Instructor Readiness",
      icon: "✅",
      roles: CHAPTER_LEAD_ONLY,
      dashboardDescription: "Clear instructor training and interview blockers.",
      dashboardPriority: 7,
      dashboardBadgeKey: "instructor_readiness_blockers",
    },
  ]),

  ...groupLinks("Account", 1000, [
    { href: "/certificates", label: "My Certificates", icon: "📜" },
    {
      href: "/alumni",
      label: "Alumni",
      icon: "🎓",
      requiresAward: true,
    },
    {
      href: "/college-advisor",
      label: "College Advisor",
      icon: "🧑‍💻",
      requiresAward: true,
    },
    { href: "/profile", label: "My Profile", icon: "👤" },
    { href: "/profile/timeline", label: "My Journey", icon: "🛤" },
    { href: "/profile/xp", label: "XP & Levels", icon: "⬆" },
    { href: "/profile/certifications", label: "Certifications", icon: "🏅" },
    { href: "/settings/personalization", label: "Personalization", icon: "🎨" },
  ]),

  ...groupLinks("Admin: People", 1100, [
    {
      href: "/admin",
      label: "Dashboard",
      icon: "📊",
      roles: ADMIN_ONLY,
      dashboardDescription: "Operate platform-wide admin queues and controls.",
      dashboardPriority: 2,
    },
    { href: "/admin/students", label: "All Students", icon: "👨‍🎓", roles: ADMIN_ONLY },
    {
      href: "/admin/instructors",
      label: "All Instructors",
      icon: "👩‍🏫",
      roles: ADMIN_ONLY,
    },
    { href: "/admin/bulk-users", label: "Bulk Users", icon: "👥", roles: ADMIN_ONLY },
    {
      href: "/admin/parent-approvals",
      label: "Parent Approvals",
      icon: "✔",
      roles: ADMIN_ONLY,
      badgeKey: "approvals",
      dashboardDescription: "Approve or reject pending parent-student link requests.",
      dashboardPriority: 4,
      dashboardBadgeKey: "pending_parent_approvals",
    },
    {
      href: "/admin/instructor-readiness",
      label: "Instructor Readiness",
      icon: "✅",
      roles: ADMIN_ONLY,
      dashboardDescription: "Resolve training, interview, and teaching-level readiness.",
      dashboardPriority: 5,
      dashboardBadgeKey: "readiness_review_queue",
    },
    { href: "/admin/staff", label: "Staff Reflections", icon: "📝", roles: ADMIN_ONLY },
    {
      href: "/admin/applications",
      label: "Applications",
      icon: "📋",
      roles: ADMIN_ONLY,
      dashboardDescription: "Review hiring pipeline and finalize pending decisions.",
      dashboardPriority: 3,
      dashboardBadgeKey: "pending_app_decisions",
    },
  ]),

  ...groupLinks("Admin: Content", 1200, [
    { href: "/admin/announcements", label: "Announcements", icon: "📢", roles: ADMIN_ONLY },
    { href: "/admin/programs", label: "Programs", icon: "📦", roles: ADMIN_ONLY },
    { href: "/admin/training", label: "Training Modules", icon: "🏫", roles: ADMIN_ONLY },
    { href: "/admin/goals", label: "Goals", icon: "🎯", roles: ADMIN_ONLY },
    { href: "/admin/reflections", label: "Reflections", icon: "💭", roles: ADMIN_ONLY },
    { href: "/admin/reflection-forms", label: "Forms", icon: "📋", roles: ADMIN_ONLY },
    { href: "/admin/incubator", label: "Incubator Mgmt", icon: "🚀", roles: ADMIN_ONLY },
  ]),

  ...groupLinks("Admin: Reports", 1300, [
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: "📈",
      roles: ADMIN_ONLY,
      dashboardDescription: "Monitor usage, outcomes, and platform health.",
      dashboardPriority: 22,
    },
    { href: "/admin/chapter-reports", label: "Chapter Reports", icon: "📊", roles: ADMIN_ONLY },
    { href: "/admin/chapters", label: "All Chapters", icon: "🏢", roles: ADMIN_ONLY },
    { href: "/admin/pathway-tracking", label: "Pathway Tracking", icon: "🛤", roles: ADMIN_ONLY },
    { href: "/admin/audit-log", label: "Audit Log", icon: "🗒", roles: ADMIN_ONLY },
    { href: "/admin/volunteer-hours", label: "Volunteer Hours", icon: "⏰", roles: ADMIN_ONLY },
    { href: "/admin/export", label: "Data Export", icon: "📥", roles: ADMIN_ONLY },
    { href: "/admin/data-export", label: "Export Tools", icon: "💾", roles: ADMIN_ONLY },
  ]),

  ...groupLinks("Admin: Ops", 1400, [
    {
      href: "/admin/waitlist",
      label: "Waitlist",
      icon: "⏳",
      roles: ADMIN_ONLY,
      dashboardDescription: "Process waitlist entries and enrollment offers.",
      dashboardPriority: 6,
      dashboardBadgeKey: "waitlist_waiting",
    },
    { href: "/admin/reminders", label: "Reminders", icon: "🔔", roles: ADMIN_ONLY },
    {
      href: "/admin/emergency-broadcast",
      label: "Emergency Broadcast",
      icon: "🚨",
      roles: ADMIN_ONLY,
    },
    { href: "/admin/mentor-match", label: "Mentor Match", icon: "🤝", roles: ADMIN_ONLY },
    { href: "/admin/alumni", label: "Alumni", icon: "🎓", roles: ADMIN_ONLY },
  ]),
];
