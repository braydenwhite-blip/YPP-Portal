import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";
import { INSTRUCTOR_SURFACE_ROLES } from "@/lib/org/role-sets";

type CatalogInput = Omit<NavLink, "group" | "priority" | "coreEligible"> & {
  coreEligible?: boolean;
};

const INSTRUCTOR_ROLES: NavRole[] = [...INSTRUCTOR_SURFACE_ROLES];
const INSTRUCTOR_AND_APPLICANT_ROLES: NavRole[] = ["APPLICANT", "INSTRUCTOR", "ADMIN", "CHAPTER_PRESIDENT"];
const MENTOR_ROLES: NavRole[] = ["MENTOR", "CHAPTER_PRESIDENT", "ADMIN"];
const MY_PROGRAM_ROLES: NavRole[] = ["STUDENT", "INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"];
const APPLICANT_ROLES: NavRole[] = ["APPLICANT", "STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"];
// Like APPLICANT_ROLES but excludes APPLICANT — used for the broader
// "My Applications" tracker, since applicants already have "My Application"
// (singular) pointing at /application-status and the plural view would
// redirect right back for them.
const APPLICANT_ROLES_EXCLUDING_APPLICANT: NavRole[] = ["STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"];
const INTERVIEW_ROLES: NavRole[] = ["INSTRUCTOR", "STAFF", "ADMIN", "CHAPTER_PRESIDENT"];
const ADMIN_ONLY: NavRole[] = ["ADMIN"];
const HIRING_CHAIR_ADMIN_ROLES: NavRole[] = ["ADMIN", "HIRING_CHAIR"];
const PARENT_ONLY: NavRole[] = ["PARENT"];
const STUDENT_ONLY: NavRole[] = ["STUDENT"];
const CHAPTER_PRESIDENT_ONLY: NavRole[] = ["CHAPTER_PRESIDENT"];
const INSTRUCTOR_APPLICANT_ONLY: NavRole[] = ["APPLICANT"];

function groupLinks(group: NavGroup, basePriority: number, links: CatalogInput[]): NavLink[] {
  return links.map((link, index) => ({
    ...link,
    group,
    priority: basePriority + index,
    coreEligible: link.coreEligible ?? true,
  }));
}

export const NAV_CATALOG: NavLink[] = [
  ...groupLinks("Start Here", 50, [
    {
      href: "/application-status",
      label: "My Application",
      icon: "📋",
      roles: INSTRUCTOR_APPLICANT_ONLY,
      dashboardDescription: "Track the status of your instructor application.",
      dashboardPriority: 1,
      coreEligible: true,
    },
    {
      href: "/my-interview",
      label: "My Interview",
      icon: "🎤",
      roles: INSTRUCTOR_APPLICANT_ONLY,
      dashboardDescription: "Schedule and track your application interview.",
      dashboardPriority: 2,
      coreEligible: true,
    },
    {
      href: "/instructor-onboarding",
      label: "Instructor Onboarding",
      icon: "🧭",
      roles: INSTRUCTOR_ROLES,
      searchAliases: ["Onboarding Guide", "Instructor Guide", "Portal Walkthrough"],
      dashboardDescription: "Read the instructor onboarding guide and portal walkthrough.",
      dashboardPriority: 3,
      coreEligible: true,
    },
  ]),

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
      href: "/parent/student-intake/new",
      label: "Start Student Journey",
      icon: "🧭",
      roles: PARENT_ONLY,
      dashboardDescription: "Begin a new parent-led student intake journey.",
      dashboardPriority: 4,
    },
    {
      href: "/parent/resources",
      label: "Resources",
      icon: "📚",
      roles: PARENT_ONLY,
      dashboardDescription: "Access parent guidance and support resources.",
      dashboardPriority: 12,
    },
    {
      href: "/parent/connect",
      label: "Connect Student",
      icon: "🔗",
      roles: PARENT_ONLY,
      dashboardDescription: "Connect and manage student link requests.",
      dashboardPriority: 11,
    },
  ]),

  ...groupLinks("Start Here", 200, [
    {
      href: "/",
      label: "Home",
      icon: "▣",
      dashboardDescription: "Your home base: what's assigned to you and what needs attention first.",
      dashboardPriority: 1,
    },
    {
      href: "/admin",
      label: "Administration",
      icon: "🛠",
      roles: ADMIN_ONLY,
      dashboardDescription:
        "Open the admin hub for hiring, programs, content, analytics, and platform operations.",
      dashboardPriority: 2,
      coreEligible: true,
    },
    {
      href: "/interviews",
      label: "Interviews",
      icon: "🎤",
      roles: INTERVIEW_ROLES,
      coreEligible: false,
      dashboardDescription: "Run interview scheduling, confirmations, and outcomes in one place.",
      dashboardPriority: 7,
      dashboardBadgeKey: "interview_queue",
    },
    {
      href: "/scheduling",
      label: "Scheduling",
      icon: "🗓",
      roles: ["APPLICANT", "STUDENT", "INSTRUCTOR", "STAFF", "ADMIN", "CHAPTER_PRESIDENT", "MENTOR"] as NavRole[],
      dashboardDescription: "See interviews, mentorship, and college-advisor scheduling work in one place.",
      dashboardPriority: 8,
    },
    {
      href: "/announcements",
      label: "Updates",
      icon: "📢",
      dashboardDescription: "Read chapter and platform updates.",
      dashboardPriority: 25,
    },
    {
      href: "/messages",
      label: "Messages",
      icon: "✉",
      roles: ["STUDENT", "INSTRUCTOR", "ADMIN", "CHAPTER_PRESIDENT", "MENTOR", "STAFF", "APPLICANT", "PARENT"] as NavRole[],
      badgeKey: "messages",
      dashboardBadgeKey: "unread_messages",
      dashboardDescription: "Open direct, parent, and interview conversations in one shared inbox.",
      dashboardPriority: 9,
    },
    { href: "/feedback/anonymous", label: "Anonymous Feedback", icon: "💬" },
  ]),

  ...groupLinks("Learning", 300, [
    {
      href: "/my-chapter",
      label: "My Chapter",
      icon: "🏠",
      roles: STUDENT_ONLY,
      dashboardDescription: "Open your chapter-first pathway hub with local runs, next steps, and fallback options.",
      dashboardPriority: 4,
    },
    { href: "/pathways", label: "Pathways", icon: "🗺" },
    { href: "/curriculum", label: "Curriculum Catalog", icon: "📖" },
    {
      href: "/my-classes",
      label: "My Classes",
      icon: "🎓",
      roles: STUDENT_ONLY,
      searchAliases: ["My Courses"],
    },
    {
      href: "/my-classes/assignments",
      label: "Assignments",
      icon: "📝",
      roles: STUDENT_ONLY,
      dashboardDescription: "Due work from all your classes in one list.",
      dashboardPriority: 5,
    },
    { href: "/curriculum/schedule", label: "My Schedule", icon: "📅", roles: STUDENT_ONLY },
    {
      href: "/curriculum/recommended",
      label: "Recommended Classes",
      icon: "⭐",
      roles: STUDENT_ONLY,
      searchAliases: ["Recommended", "Recommended Courses"],
    },
    { href: "/learn/modules", label: "Modules", icon: "📦", roles: STUDENT_ONLY },
    { href: "/learn/workshops", label: "Workshops", icon: "🔧", roles: STUDENT_ONLY },
    { href: "/learn/style-quiz", label: "Style Quiz", icon: "🧩", roles: STUDENT_ONLY },
    { href: "/learn/challenges", label: "Challenge Learning", icon: "⚡", roles: STUDENT_ONLY },
    { href: "/learn/practice", label: "Practice Log", icon: "🏋", roles: STUDENT_ONLY },
    { href: "/learn/progress", label: "My Progress", icon: "📈", roles: STUDENT_ONLY },
    {
      href: "/student-training",
      label: "Training Academy",
      icon: "🏫",
      roles: STUDENT_ONLY,
      searchAliases: ["Training", "Student Training"],
      dashboardDescription: "Complete assigned modules, checkpoints, quizzes, and evidence submissions.",
      dashboardPriority: 6,
    },
    { href: "/programs", label: "Programs Catalog", icon: "🎯" },
  ]),

  ...groupLinks("Progress", 400, [
    {
      href: "/my-growth",
      label: "My Growth",
      icon: "🌱",
      requiresGrowthOs: true,
      searchAliases: ["Growth", "Journey", "Student Operating System", "My Journey"],
      dashboardDescription:
        "Your unified growth journey — vision, goals, achievements, and what to do next.",
      dashboardPriority: 2,
    },
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
    {
      href: "/activities",
      label: "Activities",
      icon: "🧭",
      roles: STUDENT_ONLY,
      searchAliases: ["Activity Hub"],
      dashboardDescription: "Choose your next challenge, try-it, incubator, or project action.",
      dashboardPriority: 7,
    },
    { href: "/motivation", label: "Motivation", icon: "🔥", roles: STUDENT_ONLY },
    // /reflections/streaks removed — it read the retired ReflectionForm models
    // that students never wrote to. /reflection now redirects to
    // /my-mentor/reflection, the canonical self-input for the mentorship
    // review loop, so it no longer needs its own nav entry.
    {
      href: "/admin/reflections",
      label: "Reflection archive",
      icon: "💭",
      roles: ADMIN_ONLY,
      dashboardDescription: "Read-only archive of retired self-reflection submissions.",
      dashboardPriority: 9,
    },
    {
      href: "/instructor-training",
      label: "Instructor Training",
      icon: "🎓",
      searchAliases: ["Training Academy", "Training"],
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Complete all required academy modules to unlock offering approval.",
      dashboardPriority: 4,
      dashboardBadgeKey: "training_incomplete",
    },
    {
      href: "/instructor/lesson-design-studio",
      label: "Lesson Design Studio",
      icon: "🎨",
      roles: INSTRUCTOR_AND_APPLICANT_ROLES,
      dashboardDescription: "Continue your studio journey by browsing examples, completing the guided tour, and building a full curriculum in one studio.",
      dashboardPriority: 17,
    },
    {
      // Surfaced only for INSTRUCTOR-role users (resolveNavModel further
      // restricts to subtype = SUMMER_WORKSHOP, so APPLICANT and full
      // instructors don't see this in their sidebar).
      href: "/instructor/workshop-design-studio",
      label: "Workshop Design Studio",
      icon: "🛠️",
      roles: INSTRUCTOR_ROLES,
      requiresSummerWorkshopSubtype: true,
      dashboardDescription: "Propose the focused workshop you'll lead at camp — design your own or pick from the approved library.",
      dashboardPriority: 17,
      searchAliases: ["Workshop Proposal", "Workshop Outline"],
    },
    {
      href: "/lesson-plans",
      label: "Lesson Plans",
      icon: "📋",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
      dashboardDescription: "Draft and refine lesson plans for upcoming sessions.",
      dashboardPriority: 18,
    },
    {
      href: "/instructor/lesson-plans/templates",
      label: "Plan Templates",
      icon: "📄",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
    },
    {
      href: "/instructor/classes",
      label: "My Classes",
      icon: "🎓",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
      dashboardDescription: "Your teaching cockpit — what's today, attendance, reflections, and student signals.",
      dashboardPriority: 1,
    },
    {
      href: "/instructor/workspace",
      label: "Instructor Workspace",
      icon: "🧩",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
      dashboardDescription: "Plan curricula, lesson plans, offerings, and readiness in one workspace.",
      dashboardPriority: 2,
    },
    {
      href: "/instructor/curriculum-builder",
      label: "Curriculum Builder",
      icon: "🛠",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
    },
    {
      href: "/instructor/class-settings",
      label: "Class Settings",
      icon: "⚙",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
      dashboardDescription: "Manage class offerings, schedules, and publish settings.",
      dashboardPriority: 3,
    },
    {
      href: "/instructor/peer-observation",
      label: "Peer Observation",
      icon: "👁",
      roles: INSTRUCTOR_ROLES,
      featureKey: "INSTRUCTOR_TEACHING_TOOLS",
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

  ...groupLinks("Projects", 600, [
    { href: "/incubator", label: "Project Incubator", icon: "🚀" },
    { href: "/incubator/apply", label: "Apply", icon: "📩" },
    { href: "/mentor/incubator", label: "Project Mentoring", icon: "🧭", roles: MENTOR_ROLES },
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
      roles: APPLICANT_ROLES_EXCLUDING_APPLICANT,
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

  ...groupLinks("People & Support", 800, [
    {
      href: "/my-advisees",
      label: "My Advisees",
      icon: "🧭",
      // Student Advisor dashboard — the page itself only lists students
      // actually assigned to the viewer, so the link is offered to the
      // instructor-tier roles that can hold the role.
      coreEligible: false,
      roles: INSTRUCTOR_ROLES,
      searchAliases: ["Student Advisor", "Advisees", "Advising"],
      dashboardDescription: "Students assigned to you for advising — check-ins, next steps, and follow-ups.",
      dashboardPriority: 6,
    },
    {
      href: "/my-leadership",
      label: "My Leadership",
      icon: "🏛️",
      coreEligible: false,
      roles: INSTRUCTOR_ROLES,
      searchAliases: ["Leadership Roles", "Contributions", "Leadership & Contributions"],
      dashboardDescription: "Your leadership roles and contributions beyond teaching, and your Senior/Lead progress.",
      dashboardPriority: 7,
    },
    {
      href: "/actions",
      label: "Actions",
      icon: "✅",
      // My Actions is per-record guarded server-side and can be used by any
      // portal user who is assigned as Lead, Executing, or Input.
      roles: [
        "ADMIN",
        "STAFF",
        "CHAPTER_PRESIDENT",
        "HIRING_CHAIR",
        "INSTRUCTOR",
        "MENTOR",
        "STUDENT",
        "PARENT",
        "APPLICANT",
      ] as NavRole[],
      requiresActionTracker: true,
      searchAliases: [
        "Action Items",
        "Action Tracker",
        "My Action Items",
        "All Actions",
        "Overdue",
        "Waiting on",
      ],
      dashboardDescription: "Everything you lead, are executing, or owe input on — sorted by deadline.",
      dashboardPriority: 5,
    },
    {
      href: "/operations/initiatives",
      label: "Initiatives",
      icon: "🎯",
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      requiresOperationsHub: true,
      searchAliases: [
        "Initiatives",
        "Strategic initiatives",
        "Plans",
        "Quarterly goals",
        "Initiative plan",
      ],
      dashboardDescription:
        "Quarterly initiatives — open one to see linked actions and next steps.",
      dashboardPriority: 4,
    },
    // The separate Work hub and Command Center were retired in the navigation
    // overhaul — the portal is organized around real YPP objects with Home as the
    // single starting point. Their routes (/work, /command-center) now redirect,
    // so they are intentionally absent from the catalog (nav + search + site-map).
    {
      href: "/browse",
      label: "Browse",
      icon: "🗂️",
      // The database mode — one front door to every record list and search.
      roles: ["ADMIN", "STAFF", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Browse",
        "Database",
        "All records",
        "Search records",
        "Find a record",
        "Directory",
        "Raw data",
      ],
      dashboardDescription: "Search every record — people, partners, actions, meetings, and more.",
      dashboardPriority: 7,
    },
    {
      href: "/decide",
      label: "Decisions",
      icon: "⚖️",
      // Decision operating system — leadership choices, ownership gaps, blockers.
      roles: ["ADMIN", "STAFF", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Decide",
        "Decisions",
        "Decision log",
        "Needs decision",
        "Ownership gaps",
        "Approve",
      ],
      dashboardDescription:
        "Leadership choices, ownership gaps, and blockers in one calm workspace.",
      dashboardPriority: 6,
    },
    {
      href: "/delegate",
      label: "Owners",
      icon: "🤝",
      // Ownership & accountability — assign owners, reassign overdue, batch tools.
      roles: ["ADMIN", "STAFF", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Delegate",
        "Assign owner",
        "Ownership",
        "Reassign",
        "Owner lanes",
        "Accountability",
      ],
      dashboardDescription:
        "Assign ownership, close gaps, and keep work moving forward.",
      dashboardPriority: 6,
    },
    {
      href: "/review",
      label: "Weekly Review",
      icon: "📊",
      // Weekly operating review — what changed, what needs review, next week.
      roles: ["ADMIN", "STAFF", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Review",
        "Weekly review",
        "What changed",
        "Needs review",
        "Initiative review",
        "Retrospective",
      ],
      dashboardDescription:
        "Weekly progress review and what needs your attention.",
      dashboardPriority: 6,
    },
    {
      href: "/follow-up",
      label: "Follow Ups",
      icon: "🔔",
      // Waiting-on / outreach desk — who we're waiting on, what's overdue.
      roles: ["ADMIN", "STAFF", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Follow Up",
        "Follow-ups",
        "Waiting on",
        "Outreach",
        "Reminders",
        "Chase",
      ],
      dashboardDescription:
        "Stay on top of who we're waiting on and keep momentum moving.",
      dashboardPriority: 6,
    },
    {
      href: "/operations/data-360",
      label: "Connected data",
      icon: "🧠",
      // Officer-tier and above only (mirrors requireOfficer()), like the
      // Command Center. Secondary surface — never a pinned core link.
      coreEligible: false,
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      requiresOperationsHub: true,
      searchAliases: [
        "Data 360",
        "Connected Data",
        "360",
        "Entity 360",
        "Relationship Map",
        "Work Board",
        "Unified Timeline",
      ],
      dashboardDescription:
        "Every person, class, partner, meeting, and action in one connected picture — with a unified work board and needs-attention queue.",
      dashboardPriority: 6,
    },
    {
      href: "/data-360",
      label: "Data 360",
      icon: "📊",
      // Leadership intelligence surface (mirrors requireLeadership(); everyone
      // who clears that guard carries the ADMIN role). Quantitative, score-free,
      // drill-down-first — intentionally distinct from "Connected data" (the
      // operational work board) above. Reads data directly, so it is NOT gated
      // behind the action-tracker / operations-hub feature flags.
      coreEligible: false,
      roles: ["ADMIN"] as NavRole[],
      searchAliases: [
        "Data 360",
        "Organizational intelligence",
        "Executive overview",
        "KPIs",
        "Metrics",
        "Analytics",
        "Dashboard",
      ],
      dashboardDescription:
        "Quantitative organizational intelligence — KPIs, growth trends, and a factual needs-attention panel across YPP.",
      dashboardPriority: 6,
    },
    {
      href: "/operations/instructor-pairing",
      label: "Instructor pairing",
      icon: "🧩",
      // Guided pairing/coverage cockpit. Officer-tier (mirrors requireOfficer()).
      coreEligible: false,
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Pairing",
        "Instructor pairing",
        "Coverage",
        "Needs instructor",
        "Pair instructor",
        "Class coverage",
        "Partner coverage",
      ],
      dashboardDescription:
        "Which classes need instructors, who's a fit, and what pairing is blocked — as guided lanes, not a table.",
      dashboardPriority: 6,
    },
    {
      href: "/operations/advising",
      label: "Advising center",
      icon: "🎓",
      // Guided student-advising cockpit. Officer-tier (mirrors requireOfficer()).
      coreEligible: false,
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Advising",
        "Advisors",
        "Student advising",
        "Needs advisor",
        "Assign advisor",
        "Kickoff",
        "Follow-up",
        "Advising command center",
      ],
      dashboardDescription:
        "Which students need advisors, which pairings need a kickoff or follow-up, and who's overloaded — one guided cockpit.",
      dashboardPriority: 6,
    },
    {
      href: "/people",
      label: "People Hub",
      icon: "👥",
      // Master People database (Knowledge OS V2 front door). Officer-tier:
      // advisor check-in state and applicant stages are leadership reads.
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "People",
        "People Database",
        "Directory",
        "Find a person",
        "Find people",
        "People & Performance",
        "Students",
        "Instructors",
        "Advisors",
        "Members",
        "Manage classes",
        "Class operations",
        "Class review",
      ],
      dashboardDescription:
        "One hub for the people directory, leadership performance view, and (for admins) class operations.",
      dashboardPriority: 3,
    },
    // /people/develop (the Leadership Development cockpit) folded into the
    // unified Mentorship Command Center — it redirects to
    // /mentorship?view=admin and its search aliases moved onto /mentorship.
    {
      href: "/partners",
      label: "Partners",
      icon: "🤝",
      // Master Partner database (Knowledge OS V2 front door). Officer-tier.
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Partner Database",
        "Partnerships",
        "Camps",
        "Schools",
        "Organizations",
        "Relationship leads",
      ],
      dashboardDescription:
        "Every partner relationship — owner, contacts, open requests, agreements, and the next step.",
      dashboardPriority: 3,
    },
    {
      href: "/help-agent",
      label: "YPP Help Agent",
      icon: "🔎",
      // The global deterministic search/command layer (Knowledge OS V2).
      // Reachable from every page via ⌘K and the sidebar trigger; this entry
      // adds nav-search discoverability. Not an AI chatbot.
      coreEligible: false,
      roles: [
        "ADMIN",
        "STAFF",
        "CHAPTER_PRESIDENT",
        "HIRING_CHAIR",
        "MENTOR",
        "INSTRUCTOR",
        "STUDENT",
        "PARENT",
      ] as NavRole[],
      searchAliases: [
        "Help Agent",
        "Search",
        "Global Search",
        "Command Palette",
        "Find",
      ],
      dashboardDescription:
        "Find any person, partner, class, meeting, or action — and open its 360 preview from anywhere.",
      dashboardPriority: 7,
    },
    {
      href: "/operations",
      label: "Operations",
      icon: "🧭",
      // Secondary surface, not a pinned core link — keep it out of the capped
      // per-role "core" map (validate-nav enforces those limits).
      coreEligible: false,
      // Role-aware page (each role sees a tailored operating picture), so the
      // nav entry is offered broadly across People Strategy roles; the page
      // itself filters every panel by permission and feature flag.
      roles: [
        "ADMIN",
        "STAFF",
        "CHAPTER_PRESIDENT",
        "HIRING_CHAIR",
        "INSTRUCTOR",
        "MENTOR",
        "STUDENT",
      ] as NavRole[],
      requiresOperationsHub: true,
      searchAliases: [
        "People Strategy OS",
        "Operating System",
        "Operations",
        "Connections",
        "Who needs help",
        "What is overdue",
      ],
      dashboardDescription:
        "One connected operating picture: who needs help, who is responsible, what is overdue, and what to do next.",
      dashboardPriority: 4,
    },
    {
      href: "/actions/all",
      label: "All Actions",
      icon: "🗂️",
      coreEligible: false,
      // Officer-tier and above only (mirrors requireOfficer()).
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      searchAliases: [
        "Action Tracker",
        "Leadership Actions",
        "All Action Items",
        "Leadership Action Center",
        "Officer Operations",
        "Weekly Action Tracker",
      ],
      dashboardDescription: "Every leadership action item, grouped by department.",
      dashboardPriority: 5,
    },
    {
      href: "/actions/responsibility",
      label: "Responsibility Map",
      icon: "🗺️",
      coreEligible: false,
      // Officer-tier and above only (mirrors requireOfficer()).
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      searchAliases: [
        "People Risk Radar",
        "Growth Signals",
        "Workload",
        "Overloaded",
        "Succession",
        "Who owns what",
      ],
      dashboardDescription:
        "Who owns what, who is overloaded or has capacity, growth signals, and the People Risk Radar.",
      dashboardPriority: 6,
    },
    {
      // Canonical Meetings home — the single front door for every meeting
      // (officer + impact). It previews and routes; it is not a second hub.
      href: "/meetings",
      label: "Meetings",
      icon: "📅",
      // Officer-tier and above only (mirrors requireOfficer()).
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      searchAliases: [
        "Meetings",
        "Meetings home",
        "All meetings",
        "Officer Meetings",
        "Impact Meetings",
        "Agenda",
        "Decisions",
        "Follow-ups",
      ],
      dashboardDescription:
        "One place for every meeting — today, upcoming, needs prep, and recent. Open any meeting to run it.",
      dashboardPriority: 6,
    },
    {
      href: "/my-weekly-impact",
      label: "My Weekly Impact",
      icon: "📝",
      // Any contributor on an Impact team fills this out (the page self-gates on
      // the Weekly Team Briefs flag and the signed-in session).
      roles: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT", "STAFF", "ADMIN", "HIRING_CHAIR"] as NavRole[],
      requiresActionTracker: true,
      searchAliases: [
        "My Weekly Impact",
        "Weekly Impact Form",
        "Weekly Update",
        "Impact Update",
        "My Impact",
      ],
      dashboardDescription:
        "Add your part to your team's one weekly Impact presentation — what you did, what you'll show, and what you need.",
      dashboardPriority: 4,
    },
    {
      href: "/leadership-pathway",
      label: "Leadership Pathway",
      icon: "🪜",
      roles: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      searchAliases: [
        "Role",
        "Roles",
        "Senior Instructor",
        "Lead Instructor",
        "Promotion",
        "Career",
        "Growth Pathway",
        "My Mentor",
      ],
      dashboardDescription:
        "See where you fit on the YPP instructor pathway and who's mentoring you.",
      dashboardPriority: 4,
    },
    {
      href: "/mentorship",
      label: "Mentorship",
      icon: "🤝",
      // The unified Mentorship Command Center — mentee ("My Development"),
      // mentor (coaching console), and leadership (command center) POVs on
      // one URL. Replaces the separate /my-mentor front door and the
      // /people/develop cockpit (both now redirect here).
      roles: [
        "INSTRUCTOR",
        "MENTOR",
        "CHAPTER_PRESIDENT",
        "HIRING_CHAIR",
        "STAFF",
        "ADMIN",
      ] as NavRole[],
      searchAliases: [
        "Support Hub",
        "Mentees",
        "Relationships",
        "My Mentor",
        "My Development",
        "Leadership development",
        "Development cockpit",
        "Coaching",
        "Development record",
        "Ready for more",
        "Needs coach",
        "My Awards",
        "Monthly Reflection",
        // Check-ins now live inside each person's Mentorship workspace.
        "Check-in",
        "Check-ins",
        "Conversation",
        "Growth opportunities",
        "Workspace",
      ],
      dashboardDescription:
        "Your development, your mentees, and the command center for developing the people who run YPP.",
      dashboardPriority: 4,
    },
    // /my-mentor now redirects to /mentorship?view=me (the mentee POV). Its
    // detail subroutes (goals, progress, reflection, schedule, resources,
    // awards) still live under /my-mentor/* and are linked from the hub.
    {
      href: "/mentorship/cycles",
      label: "Review Cycles",
      icon: "🔄",
      // Cohort review launcher + progress board. Officer-tier in nav; the
      // page additionally requires leadership (mirrors the old /people/develop
      // gating).
      roles: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as NavRole[],
      searchAliases: [
        "Cohort review",
        "Review cycle",
        "Launch reviews",
        "Review progress",
      ],
      dashboardDescription:
        "Launch a review for one person or a whole cohort, and see who is waiting on self-input, review, or chair approval.",
      dashboardPriority: 6,
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
    {
      href: "/mentorship/reviews",
      label: "Review Inbox",
      icon: "✅",
      roles: MENTOR_ROLES,
      searchAliases: ["Chair Queue", "Review Approvals", "Monthly Review Inbox"],
      dashboardDescription: "Approve or return monthly goal reviews waiting on chair action.",
      dashboardPriority: 6,
    },
    {
      href: "/mentorship/schedule",
      label: "Mentor Schedule",
      icon: "📅",
      roles: MENTOR_ROLES,
      dashboardDescription: "Manage availability and confirm session requests from your mentees.",
      dashboardPriority: 8,
    },
    {
      href: "/mentorship/feedback",
      label: "Feedback Portal",
      icon: "💬",
      roles: MENTOR_ROLES,
      searchAliases: ["Mentee Feedback", "Feedback Requests", "Review Work"],
      dashboardDescription: "Respond to private feedback requests on mentee projects, drafts, and work samples.",
      dashboardPriority: 9,
    },
    {
      href: "/mentorship/ask",
      label: "Ask a Mentor",
      icon: "❓",
      roles: MENTOR_ROLES,
      searchAliases: ["Mentor Commons", "Mentor Q&A", "Answer Questions"],
      dashboardDescription: "Answer public questions and grow the shared mentor knowledge commons.",
      dashboardPriority: 10,
    },
    {
      href: "/mentorship/resources",
      label: "Mentor Resources",
      icon: "📚",
      roles: MENTOR_ROLES,
      searchAliases: ["Resource Commons", "Mentor Playbooks"],
      dashboardDescription: "Search and publish shared playbooks, templates, and resources from mentoring work.",
      dashboardPriority: 11,
    },
    // /mentorship/unlock-sections is intentionally not surfaced in top-level
    // nav -- it's a legacy student-section unlock page (gamification suite,
    // default off) kept reachable by direct URL only; recommendations it
    // creates are approved at /admin/unlock-approvals.
    {
      href: "/my-program",
      label: "My Program",
      icon: "🎯",
      roles: MY_PROGRAM_ROLES,
      searchAliases: ["My Mentor", "Support Hub", "Program Hub"],
      dashboardDescription: "Open your support hub for reflections, next steps, awards, rewards, and recognition.",
    },
    {
      href: "/my-program/gr",
      label: "My Goals",
      icon: "📋",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      featureKey: "GR_SYSTEM",
      searchAliases: ["My G&R", "Goals & Responsibilities"],
      dashboardDescription: "View your Goals & Responsibilities document, track progress, and update your plan of action.",
      dashboardPriority: 5,
    },
    // Removed from nav:
    //   /mentorship-program           -> redirects to /mentorship
    //   /mentorship-program/reviews   -> mentor surface duplicates the per-
    //                                    mentee "Write Review" CTA on the
    //                                    mentee detail page; mentee surface
    //                                    is the monthly self-reflection form
    //                                    accessed from the mentee dashboard.
    // /mentorship-program/chair removed from nav — it is a legacy redirect to
    // /mentorship/reviews, which already surfaces for ADMIN via MENTOR_ROLES.
    // Two "Chair Queue" entries created a duplicate visible label for admins.
    {
      href: "/mentorship/awards",
      label: "Awards",
      icon: "🏆",
      roles: ["MENTOR", "CHAPTER_PRESIDENT", "ADMIN"] as NavRole[],
      dashboardDescription: "Nominate mentees for Bronze, Silver, Gold, and Lifetime achievement awards.",
    },
    // /my-mentor/awards removed from nav — awards are a supporting detail of
    // the Mentorship hub's "My development" view, reachable from its
    // drill-down grid and subnav. A separate top-level entry duplicated the
    // product.
    {
      href: "/my-program/achievement-journey",
      label: "Achievement Journey",
      icon: "🏆",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      dashboardDescription: "Visualize your tier progress, earning velocity, and point history.",
    },
    {
      href: "/instructor-growth",
      label: "Instructor Growth",
      icon: "📈",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN"] as NavRole[],
      dashboardDescription: "Track private instructor XP, tiers, badges, and semester momentum.",
      dashboardPriority: 7,
    },
    {
      href: "/instructor-growth/review",
      label: "Growth Review Board",
      icon: "🗂️",
      roles: ["MENTOR", "CHAPTER_PRESIDENT", "ADMIN"] as NavRole[],
      dashboardDescription: "Review pending instructor growth claims in mentor and leadership lanes.",
      dashboardPriority: 7,
    },
    {
      href: "/my-program/schedule",
      label: "Schedule Meeting",
      icon: "📅",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      dashboardDescription: "Request a meeting with your mentor or manage upcoming sessions.",
    },
    // Removed from nav:
    //   /mentorship-program/schedule  -> redirects to /mentorship/schedule
    //   /mentorship/calendar          -> redirects to /mentorship/schedule
    // The canonical "Mentor Schedule" entry sits above next to "My Mentees".
    {
      href: "/peer-recognition",
      label: "Peer Recognition",
      icon: "🎉",
      dashboardDescription: "Send kudos and celebrate your teammates' contributions.",
    },
    {
      href: "/my-program/certificate",
      label: "My Certificate",
      icon: "📜",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      dashboardDescription: "Download your achievement certificate and volunteer hours verification letter.",
    },
    {
      href: "/college-advisor/roadmap",
      label: "College Roadmap",
      icon: "🎓",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      dashboardDescription: "Follow your personalized college readiness journey from exploration to transition.",
    },
    {
      href: "/college-advisor/activities",
      label: "Activities Builder",
      icon: "📋",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT", "ADMIN", "STAFF"] as NavRole[],
      dashboardDescription: "Build your extracurricular portfolio and export in Common App format.",
    },
    {
      href: "/alumni-network",
      label: "Alumni Network",
      icon: "🤝",
      dashboardDescription: "Connect with YPP alumni, attend panel events, and send intro requests.",
    },
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
    {
      href: "/attendance",
      label: "Attendance",
      icon: "📋",
      roles: INSTRUCTOR_ROLES,
      dashboardDescription: "Record and review class attendance sessions.",
      dashboardPriority: 11,
    },
    {
      href: "/instructor/parent-feedback",
      label: "Parent Feedback",
      icon: "💬",
      roles: ["INSTRUCTOR", "CHAPTER_PRESIDENT"] as NavRole[],
      dashboardDescription: "View parent feedback and communications for your classes.",
      dashboardPriority: 13,
    },
  ]),

  ...groupLinks("Chapters", 900, [
    {
      href: "/chapter/hub",
      label: "Chapter Hub",
      icon: "🏘",
      dashboardDescription: "Open one page with every chapter tool and directory link.",
      dashboardPriority: 1,
      coreEligible: true,
      searchAliases: ["Chapter", "Chapter tools", "Chapter directory", "Members", "Channels", "Leaderboard"],
    },
    {
      href: "/chapters",
      label: "Find a Chapter",
      icon: "🔍",
      dashboardDescription: "Browse chapters and find a community near you.",
      dashboardPriority: 26,
    },
    {
      href: "/join-chapter",
      label: "Join a Chapter",
      icon: "🤝",
      dashboardDescription: "Pick a chapter to join and start your journey.",
      dashboardPriority: 25,
    },
    {
      href: "/chapter/apply",
      label: "Apply for CP",
      icon: "🗺",
      dashboardDescription: "Apply to become a chapter president and lead a YPP chapter.",
      dashboardPriority: 13,
    },
    {
      href: "/chapter",
      label: "Chapter Home",
      icon: "🧭",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription:
        "Run your chapter: health, what needs you, launch checklist, meetings, members, and programs.",
      dashboardPriority: 1,
      searchAliases: [
        "Dashboard",
        "Chapter Home",
        "President Home",
        "Overview",
        "Workspace",
        "Launch checklist",
        "Command Center",
      ],
    },
    {
      href: "/chapter/operating",
      label: "Operating System",
      icon: "🛠",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription:
        "Run Weeks 1–10: partners, instructors, curriculum, classes, launch readiness, and impact-meeting prep.",
      dashboardPriority: 2,
      searchAliases: [
        "Operating System",
        "Chapter OS",
        "Pipeline",
        "Partner pipeline",
        "Instructor pipeline",
        "Launch readiness",
        "Impact meeting prep",
      ],
    },
    {
      href: "/chapter/impact",
      label: "Impact Meeting",
      icon: "📊",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription:
        "Your generated weekly brief — what changed, current numbers, wins, risks, decisions, and next-week commitments — ready to present.",
      dashboardPriority: 3,
      searchAliases: [
        "Impact Meeting",
        "Weekly brief",
        "Impact brief",
        "Meeting prep",
        "What changed this week",
        "Chapter report",
      ],
    },
    {
      href: "/chapter/organization",
      label: "Organization Graph",
      icon: "🕸",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription:
        "See your whole chapter as one connected model — every partner, class, instructor, and student, with their dependencies and recommended next moves.",
      dashboardPriority: 3,
      searchAliases: [
        "Organization Graph",
        "Org graph",
        "Entity 360",
        "Relationships",
        "Dependencies",
        "Connected chapter",
        "Digital twin",
      ],
    },
    {
      href: "/chapter/calendar",
      label: "Chapter Calendar",
      icon: "🗓",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Create chapter events, recurring series, and public calendar items.",
      dashboardPriority: 4,
    },
    {
      href: "/chapter/student-intake",
      label: "Student Intake",
      icon: "🧭",
      roles: ["CHAPTER_PRESIDENT", "ADMIN"] as NavRole[],
      dashboardDescription: "Review parent-led student journeys and launch early support plans.",
      dashboardPriority: 5,
    },
    {
      href: "/chapter/onboarding",
      label: "CP Onboarding",
      icon: "🎓",
      roles: CHAPTER_PRESIDENT_ONLY,
    },
    {
      href: "/chapter/recruiting",
      label: "Chapter Recruiting",
      icon: "🧑‍💼",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Manage openings, candidates, interviews, and decisions.",
      dashboardPriority: 2,
      dashboardBadgeKey: "chapter_recruiting_queue",
    },
    {
      href: "/chapter/channels",
      label: "Chapter Channels",
      icon: "💬",
      dashboardDescription: "Discussion channels for your chapter community.",
      dashboardPriority: 22,
    },
    {
      href: "/chapter/updates",
      label: "Chapter Announcements",
      icon: "📢",
      roles: CHAPTER_PRESIDENT_ONLY,
      coreEligible: false,
      dashboardDescription: "Post announcements and updates to your chapter.",
      dashboardPriority: 22,
      searchAliases: ["Announcements", "Chapter Updates", "Post Update"],
    },
    {
      href: "/chapter/members",
      label: "Chapter Members",
      icon: "👥",
      dashboardDescription: "View and search your chapter's member directory.",
      dashboardPriority: 21,
    },
    {
      href: "/chapter/students",
      label: "Chapter Students",
      icon: "🎓",
      roles: CHAPTER_PRESIDENT_ONLY,
      coreEligible: false,
      dashboardDescription: "Track student rosters, enrollment, and engagement.",
      dashboardPriority: 21,
      searchAliases: ["Students", "Student Roster"],
    },
    {
      href: "/chapter/instructors",
      label: "Chapter Instructors",
      icon: "👩‍🏫",
      roles: CHAPTER_PRESIDENT_ONLY,
      coreEligible: false,
      dashboardDescription: "Monitor instructor training, courses, and goals.",
      dashboardPriority: 21,
      searchAliases: ["Instructors", "Instructor Roster"],
    },
    {
      href: "/chapter/marketing",
      label: "Chapter Marketing",
      icon: "📊",
      roles: CHAPTER_PRESIDENT_ONLY,
      coreEligible: false,
      dashboardDescription: "Log outreach metrics and track growth goals.",
      dashboardPriority: 24,
      searchAliases: ["Marketing", "Outreach", "Growth"],
    },
    {
      href: "/chapter/leaderboard",
      label: "XP Leaderboard",
      icon: "🥇",
      dashboardDescription: "See who's leading in XP within your chapter.",
      dashboardPriority: 25,
    },
    {
      href: "/chapter/achievements",
      label: "Chapter Achievements",
      icon: "🎯",
      dashboardDescription: "Track your chapter's collective milestones and achievements.",
      dashboardPriority: 26,
    },
    {
      href: "/chapter/invites",
      label: "Invite Links",
      icon: "🔗",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Create and manage shareable invite links to grow your chapter.",
      dashboardPriority: 23,
    },
    {
      href: "/chapters/leaderboard",
      label: "Network Chapter Leaderboard",
      icon: "🏆",
      dashboardDescription: "See how chapters across the network are growing.",
      dashboardPriority: 24,
    },
    {
      href: "/admin/chapters",
      label: "Chapter Command",
      icon: "🏢",
      roles: ADMIN_ONLY,
      dashboardDescription: "Launch, support, and manage every chapter across the national pipeline.",
      dashboardPriority: 3,
      searchAliases: ["Chapters", "Chapter Directory", "Chapter pipeline", "Launching chapters", "At-risk chapters"],
    },
    {
      href: "/admin/chapters/map",
      label: "Chapter Map",
      icon: "🗺",
      roles: ADMIN_ONLY,
      dashboardDescription: "See where chapters exist, where they're launching, and where the gaps are.",
      dashboardPriority: 23,
    },
    {
      href: "/admin/chapters/analytics",
      label: "Chapter Analytics",
      icon: "📈",
      roles: ADMIN_ONLY,
      dashboardDescription: "National growth metrics: applications, approvals, and chapters per state.",
      dashboardPriority: 23,
    },
    {
      href: "/chapter/settings",
      label: "Chapter Settings",
      icon: "⚙️",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Customize your chapter profile, branding, and join policy.",
      dashboardPriority: 20,
    },
    {
      href: "/chapter-lead/instructor-applicants",
      label: "Chapter Applicants",
      icon: "📝",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Review and manage instructor applications on your chapter's hiring board.",
      dashboardPriority: 6,
      searchAliases: ["Instructor Applicants", "Chapter Instructor Applicants"],
    },
    {
      href: "/chapter-lead/instructor-readiness",
      label: "Chapter Readiness",
      icon: "✅",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Clear instructor training and interview blockers for your chapter.",
      dashboardPriority: 7,
      dashboardBadgeKey: "instructor_readiness_blockers",
      searchAliases: ["Instructor Readiness", "Chapter Instructor Readiness"],
    },
    {
      href: "/chapter-lead/portal-rollout",
      label: "Rollout Command",
      icon: "🗓",
      roles: CHAPTER_PRESIDENT_ONLY,
      dashboardDescription: "Track chapter rollout timeline, owners, and blockers.",
      dashboardPriority: 5,
    },
  ]),

  ...groupLinks("Profile & Settings", 1000, [
    { href: "/certificates", label: "My Certificates", icon: "📜" },
    {
      href: "/alumni",
      label: "Alumni Directory",
      icon: "🎓",
      requiresAward: true,
    },
    {
      href: "/college-advisor",
      label: "College Advisor",
      icon: "🧑‍💻",
      requiresAward: true,
    },
    {
      href: "/advisor-dashboard",
      label: "Advisor Dashboard",
      icon: "📋",
      requiresAward: true,
    },
    {
      href: "/profile",
      label: "My Profile",
      icon: "👤",
      hideForPrimaryRoles: ["INSTRUCTOR"],
    },
    { href: "/profile/timeline", label: "My Journey", icon: "🛤" },
    { href: "/profile/xp", label: "XP & Levels", icon: "⬆" },
    { href: "/profile/certifications", label: "Certifications", icon: "🏅" },
    { href: "/settings/personalization", label: "Profile & Settings", icon: "👤" },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "🔔",
      badgeKey: "notifications",
      dashboardBadgeKey: "unread_notifications",
      dashboardDescription: "Review unread alerts and updates.",
      dashboardPriority: 10,
    },
  ]),

  ...groupLinks("Admin People", 1100, [
    { href: "/admin/students", label: "All Students", icon: "👨‍🎓", roles: ADMIN_ONLY },
    {
      href: "/admin/leadership",
      label: "Leadership Roles",
      icon: "🏛️",
      coreEligible: false,
      roles: ADMIN_ONLY,
      searchAliases: [
        "Leadership Contributions",
        "Student Advisors",
        "Advisor Assignments",
        "Senior Lead Expectations",
      ],
      dashboardDescription:
        "Assign and track leadership roles — Student Advisors, mentors, reviewers, committee, and ownership areas.",
      dashboardPriority: 6,
    },
    {
      href: "/admin/instructors",
      label: "All Instructors",
      icon: "👩‍🏫",
      roles: ADMIN_ONLY,
    },
    {
      href: "/admin/instructor-assignments",
      label: "Instructor Assignments",
      icon: "🧩",
      roles: ADMIN_ONLY,
      dashboardDescription: "Assign regular instructors to class offerings and track coverage.",
      dashboardPriority: 5,
      searchAliases: [
        "Regular Instructor Assignments",
        "Class Coverage",
        "Instructor Coverage",
      ],
    },
    { href: "/admin/bulk-users", label: "Bulk Users", icon: "👥", roles: ADMIN_ONLY },
    {
      href: "/admin/role-management",
      label: "Role Management",
      icon: "🪪",
      roles: ADMIN_ONLY,
      searchAliases: [
        "Roles",
        "User roles",
        "Set roles",
        "Promote",
        "Promotion",
        "Promotional view",
        "Role assignments",
        "Cohort",
        "Cohorts",
        "Group",
        "Ladder",
        "Level",
      ],
      dashboardDescription:
        "Set every user's exact roles, ladder/level, and cohort from one place.",
    },
    {
      href: "/admin/settings",
      label: "Portal Settings",
      icon: "⚙️",
      roles: ADMIN_ONLY,
      searchAliases: [
        "Settings",
        "Thresholds",
        "Business rules",
        "Configuration",
        "Config",
        "SLA",
      ],
      dashboardDescription:
        "Edit business-rule thresholds (SLAs, row caps, feedback limits) used across the portal.",
    },
    {
      href: "/admin/teams",
      label: "Teams",
      icon: "🧩",
      roles: ADMIN_ONLY,
      searchAliases: ["Teams", "Team config", "Weekly Impact teams", "Team membership"],
      dashboardDescription:
        "Create teams and assign members for Weekly Impact and team meetings.",
    },
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
      href: "/admin/instructor-applicants",
      label: "Network Applicants",
      icon: "📝",
      roles: HIRING_CHAIR_ADMIN_ROLES,
      dashboardDescription: "Review and approve incoming instructor applications across all chapters.",
      dashboardPriority: 4,
      searchAliases: ["Instructor Applicants", "Network Instructor Applicants"],
      dashboardBadgeKey: "instructor_applicants",
    },
    {
      href: "/admin/instructor-applicants/chair-queue",
      label: "Hiring Chair Queue",
      icon: "⚖️",
      roles: HIRING_CHAIR_ADMIN_ROLES,
      badgeKey: "chairQueueCount",
      dashboardDescription: "Review applications awaiting hiring chair decision.",
      searchAliases: ["chair", "hiring chair", "decisions", "Chair Queue"],
    },
    {
      href: "/admin/instructor-applicants/chair-settings",
      label: "Chair Assignment",
      icon: "🪑",
      roles: ADMIN_ONLY,
      dashboardDescription:
        "Assign the active Chair — the one person who can make final applicant decisions.",
      searchAliases: [
        "Chair Assignment",
        "Active Chair",
        "Assign Chair",
        "Set Chair",
        "Chair Settings",
      ],
    },
    {
      href: "/admin/chapter-president-applicants",
      label: "CP Applicants",
      icon: "👑",
      roles: ADMIN_ONLY,
      dashboardDescription: "Review and manage chapter president applications.",
      dashboardPriority: 4,
    },
    {
      href: "/admin/form-templates",
      label: "Form Templates",
      icon: "📝",
      roles: ADMIN_ONLY,
    },
    {
      href: "/admin/application-cohorts",
      label: "Application Cohorts",
      icon: "👥",
      roles: ADMIN_ONLY,
    },
    {
      href: "/admin/parent-feedback",
      label: "Parent Feedback",
      icon: "💬",
      roles: ADMIN_ONLY,
    },
    {
      href: "/admin/instructor-readiness",
      label: "Network Readiness",
      icon: "✅",
      roles: ADMIN_ONLY,
      dashboardDescription: "Resolve training, interview, and teaching-level readiness across all chapters.",
      dashboardPriority: 5,
      dashboardBadgeKey: "readiness_review_queue",
      searchAliases: ["Instructor Readiness", "Network Instructor Readiness"],
    },
    {
      href: "/admin/portal-rollout",
      label: "Rollout Command",
      icon: "🗓",
      roles: ADMIN_ONLY,
      dashboardDescription: "Track launch timeline, ownership, and blockers.",
      dashboardPriority: 6,
    },
    { href: "/admin/staff", label: "Staff Reflections", icon: "📝", roles: ADMIN_ONLY },
    {
      // Legacy Position-based hiring pipeline (Application/Decision models).
      // Distinct from the modern InstructorApplication board at
      // /admin/instructor-applicants. Relabeled to reduce confusion for admins
      // who saw two "Applications" entries side-by-side.
      href: "/admin/applications",
      label: "Position Applications (Legacy)",
      icon: "📋",
      roles: ADMIN_ONLY,
      dashboardDescription: "Legacy position-based hiring pipeline. Modern instructor applications live in Network Applicants.",
      dashboardPriority: 3,
      dashboardBadgeKey: "pending_app_decisions",
      searchAliases: ["Applications", "Hiring Pipeline"],
    },
    {
      href: "/admin/recruiting",
      label: "Recruiting Center",
      icon: "🧑‍💼",
      roles: ADMIN_ONLY,
      dashboardDescription: "Create chapter openings and monitor interview/decision flow.",
      dashboardPriority: 4,
      dashboardBadgeKey: "pending_app_decisions",
    },
  ]),

  ...groupLinks("Admin Content", 1200, [
    { href: "/admin/announcements", label: "Manage Updates", icon: "📢", roles: ADMIN_ONLY },
    { href: "/admin/rollout-comms", label: "Rollout Comms", icon: "✉️", roles: ADMIN_ONLY },
    { href: "/admin/programs", label: "Manage Programs", icon: "📦", roles: ADMIN_ONLY },
    {
      href: "/admin/classes",
      label: "Class Operations",
      icon: "🏫",
      roles: ADMIN_ONLY,
      coreEligible: false,
      dashboardDescription: "Manage class offerings, sections, rosters, and scheduling across the network.",
      searchAliases: ["Classes", "Sections", "Class management", "Class operations"],
    },
    { href: "/admin/training", label: "Training Modules", icon: "🏫", roles: ADMIN_ONLY },
    { href: "/admin/goals", label: "Goals", icon: "🎯", roles: ADMIN_ONLY },
    // /admin/reflection-forms removed — the legacy form builder now redirects
    // to the read-only /admin/reflections archive.
    { href: "/admin/challenges", label: "Challenges Mgmt", icon: "⚡", roles: ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"] },
    { href: "/admin/activities", label: "Activities Mgmt", icon: "🧭", roles: ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"] },
    { href: "/admin/passions", label: "Passion Areas", icon: "🌍", roles: ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"] },
    { href: "/admin/incubator", label: "Incubator Mgmt", icon: "🚀", roles: ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"] },
    {
      href: "/admin/curricula",
      label: "Curriculum Review",
      icon: "📝",
      roles: ["ADMIN", "CHAPTER_PRESIDENT"] as NavRole[],
      dashboardDescription: "Review and approve instructor-submitted curricula before they go live.",
      dashboardPriority: 8,
      dashboardBadgeKey: "pending_curriculum_review",
    },
    {
      href: "/admin/course-library",
      label: "Course Library",
      icon: "📚",
      roles: ADMIN_ONLY,
      dashboardDescription:
        "Curate the courses instructors pick from instead of building from scratch.",
      dashboardPriority: 7,
    },
    {
      href: "/admin/workshop-library",
      label: "Workshop Library",
      icon: "🎒",
      roles: ADMIN_ONLY,
      dashboardDescription: "Curate the workshops Summer Workshop applicants can pick from.",
      dashboardPriority: 9,
    },
    {
      href: "/admin/workshop-reviews",
      label: "Workshop Reviews",
      icon: "🧐",
      roles: ["ADMIN", "CHAPTER_PRESIDENT"] as NavRole[],
      dashboardDescription: "Score Summer Workshop Instructor proposals and committed decisions.",
      dashboardPriority: 9,
    },
    {
      href: "/admin/opportunities",
      label: "Workshop & Camp Assignments",
      icon: "🎯",
      roles: ADMIN_ONLY,
      dashboardDescription: "Manage partner camps and workshops, see uncovered slots, and assign instructors.",
      dashboardPriority: 9,
      searchAliases: [
        "Opportunities",
        "Camp Assignments",
        "Instructor Assignments",
        "Workshop Assignments",
      ],
    },
    {
      href: "/admin/partners",
      // "Partners" is the master database at /partners now; this is the
      // admin CRUD/pipeline tool (renamed to keep visible labels unique).
      label: "Partner Admin",
      icon: "🤝",
      roles: ADMIN_ONLY,
      dashboardDescription: "Add/edit partners, move pipeline stages, and run the partnership report.",
      dashboardPriority: 9,
      searchAliases: ["Partner Directory", "Relationship Leads", "Partner Pipeline"],
    },
  ]),

  ...groupLinks("Admin Reports", 1300, [
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: "📈",
      roles: ADMIN_ONLY,
      dashboardDescription: "Monitor usage, outcomes, and platform health.",
      dashboardPriority: 22,
    },
    { href: "/admin/chapter-reports", label: "Chapter Reports", icon: "📊", roles: ADMIN_ONLY },
    { href: "/admin/pathway-tracking", label: "Pathway Tracking", icon: "🛤", roles: ADMIN_ONLY },
    { href: "/admin/pathways", label: "Manage Pathways", icon: "🗺", roles: ADMIN_ONLY },
    { href: "/admin/audit-log", label: "Audit Log", icon: "🗒", roles: ADMIN_ONLY },
    { href: "/admin/governance", label: "Governance & Risk", icon: "🛡", roles: ADMIN_ONLY },
    { href: "/admin/role-matrix", label: "Role Matrix Audit", icon: "👥", roles: ADMIN_ONLY },
    { href: "/admin/volunteer-hours", label: "Volunteer Hours", icon: "⏰", roles: ADMIN_ONLY },
    { href: "/admin/export", label: "Data Export", icon: "📥", roles: ADMIN_ONLY },
    { href: "/admin/data-export", label: "Export Tools", icon: "💾", roles: ADMIN_ONLY },
  ]),

  ...groupLinks("Admin Operations", 1400, [
    {
      href: "/admin/feature-gates",
      label: "Feature Access",
      icon: "🔑",
      roles: ADMIN_ONLY,
      dashboardDescription: "Grant or revoke per-user feature access (e.g., optional modules, Teaching Tools).",
    },
    {
      href: "/admin/hiring-committee",
      label: "Hiring Chair Queue",
      icon: "✅",
      roles: ADMIN_ONLY,
      dashboardDescription: "Approve or return hiring decisions before they are finalized.",
      dashboardBadgeKey: "pending_hiring_decisions",
    },
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
      href: "/admin/email-templates",
      label: "Email Templates",
      icon: "✉️",
      roles: ADMIN_ONLY,
      dashboardDescription: "Customize the subject and body of automated portal emails.",
      searchAliases: ["Email Templates", "Edit Emails", "Email Copy"],
    },
    {
      href: "/admin/emergency-broadcast",
      label: "Emergency Broadcast",
      icon: "🚨",
      roles: ADMIN_ONLY,
    },
    {
      href: "/admin/mentorship",
      // "Mentorship Ops" (not "Mentorship") so ADMIN doesn't see the label twice —
      // the member-facing hub already owns "Mentorship" (/mentorship).
      label: "Mentorship Ops",
      icon: "🎯",
      roles: ADMIN_ONLY,
      searchAliases: ["Mentorship admin", "Mentorship health", "Assignments", "Approvals"],
      dashboardDescription: "Oversee mentorship health, assignments, approvals, G&R, committees, and analytics.",
      dashboardPriority: 6,
    },
    { href: "/admin/alumni", label: "Manage Alumni", icon: "🎓", roles: ADMIN_ONLY },
    { href: "/admin/unlock-approvals", label: "Unlock Approvals", icon: "🔓", roles: ADMIN_ONLY, dashboardDescription: "Review and approve section unlock recommendations from mentors." },
    {
      href: "/workflows",
      label: "Workflows",
      icon: "⚙️",
      roles: ["ADMIN", "STAFF"],
      searchAliases: ["Workflow Engine", "Processes", "MissionOS", "Workflow Runner"],
      dashboardDescription: "Run any business process as a reusable workflow — hiring, onboarding, launches, and more.",
      coreEligible: false,
    },
    {
      href: "/admin/workflow-templates",
      label: "Workflow Templates",
      icon: "🧩",
      roles: ADMIN_ONLY,
      searchAliases: ["Workflow Builder", "Process Templates", "Workflow Blueprints"],
      dashboardDescription: "Design reusable workflow templates with stages, steps, automation, and exit criteria.",
      coreEligible: false,
    },
    // The legacy "Action Center" sidebar entry was retired in the Phase 5
    // consolidation — the People Strategy Action Tracker (/actions/*) is now the
    // single canonical surface. The old /admin/action-center pages remain
    // reachable by direct URL until the leadership data is migrated across (see
    // scripts/migrate-leadership-action-items.ts).
  ]),
];
