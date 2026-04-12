import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const REGISTRY_PATH = path.join(ROOT, "lib/page-helper/registry.ts");

const ROUTE_GROUP_SEGMENT = /^\(.*\)$/;
const DYNAMIC_SEGMENT = /^\[.+\]$/;
const ACTION_SEGMENTS = new Set(["new", "create", "submit", "apply", "propose", "connect", "share", "nominate", "edit"]);
const COUNTABLE_WORD_OVERRIDES = new Map([
  ["analytics", "analytics"],
  ["awards", "awards"],
  ["badges", "badges"],
  ["certificates", "certificates"],
  ["feedback", "feedback"],
  ["history", "history"],
  ["news", "news"],
  ["notifications", "notifications"],
  ["progress", "progress"],
  ["settings", "settings"],
  ["stories", "stories"],
]);

const SEGMENT_LABELS = new Map([
  ["achievements", "Achievements"],
  ["admin", "Admin"],
  ["alumni-network", "Alumni Network"],
  ["ask-alum", "Ask an Alum"],
  ["audit-log", "Audit Log"],
  ["bulk-users", "Bulk Users"],
  ["chapter-lead", "Chapter Lead"],
  ["chapter-president-applicants", "Chapter President Applicants"],
  ["check-in", "Check-In"],
  ["co-instructors", "Co-Instructors"],
  ["curriculum", "Curriculum"],
  ["data-export", "Data Export"],
  ["feature-gates", "Feature Access"],
  ["forgot-password", "Forgot Password"],
  ["goals", "Goals"],
  ["gr", "Goals & Responsibilities"],
  ["gr-assignments", "G&R Assignments"],
  ["gr-resources", "G&R Resources"],
  ["gr-templates", "G&R Templates"],
  ["id", "Details"],
  ["incubator", "Incubator"],
  ["instructor-applicants", "Instructor Applicants"],
  ["instructor-readiness", "Instructor Readiness"],
  ["internships", "Internships"],
  ["lesson-design-studio", "Lesson Design Studio"],
  ["magic-link", "Magic Link"],
  ["mentorship-program", "Mentorship Program"],
  ["my-chapter", "My Chapter"],
  ["my-classes", "My Classes"],
  ["my-courses", "My Courses"],
  ["my-mentor", "My Mentor"],
  ["my-program", "My Program"],
  ["not-found", "Not Found"],
  ["office-hours", "Office Hours"],
  ["onboarding", "Onboarding"],
  ["parent-feedback", "Parent Feedback"],
  ["pathway-fallbacks", "Pathway Fallbacks"],
  ["pathways", "Pathways"],
  ["peer-observation", "Peer Observation"],
  ["peer-recognition", "Peer Recognition"],
  ["portal-rollout", "Portal Rollout"],
  ["progress-gallery", "Progress Gallery"],
  ["reset-password", "Reset Password"],
  ["resource-exchange", "Resource Exchange"],
  ["role-matrix", "Role Matrix"],
  ["rollout-comms", "Rollout Communications"],
  ["scholarships", "Scholarships"],
  ["service-projects", "Service Projects"],
  ["showcases", "Showcases"],
  ["sign-up", "Sign Up"],
  ["signup", "Sign Up"],
  ["student-intake", "Student Intake"],
  ["student-of-month", "Student of the Month"],
  ["student-spotlight", "Student Spotlight"],
  ["study-groups", "Study Groups"],
  ["substitute-request", "Substitute Request"],
  ["try-it", "Try-It Sessions"],
  ["unlock-approvals", "Unlock Approvals"],
  ["unlock-sections", "Unlock Sections"],
  ["verify-email", "Verify Email"],
  ["volunteer-hours", "Volunteer Hours"],
  ["wall-of-fame", "Wall of Fame"],
  ["waitlist", "Waitlist"],
  ["xp", "XP & Levels"],
]);

const ENTRY_OVERRIDES = {
  "/": {
    title: "Portal Home",
    content: {
      purpose:
        "This home page is your role-based command center for assigned work and recent alerts.",
      firstStep:
        "Open the first next action with the nearest due date or the item that is already assigned to you.",
      nextStep:
        "When you finish an action, the workflow record updates and the next owner or next stage appears automatically.",
    },
    roleOverrides: {
      ADMIN: {
        purpose:
          "This home page is your admin command center for queues, approvals, and the items that need attention first.",
        firstStep:
          "Start with the highest-priority queue card or overdue workflow item at the top of the page.",
        nextStep:
          "After you move work forward, the next owner, next stage, or refreshed count appears automatically.",
      },
      INSTRUCTOR: {
        purpose:
          "This home page is your teaching command center for follow-up tasks, alerts, and student-facing work.",
        firstStep:
          "Open the next teaching or follow-up item with the closest deadline or the clearest blocker.",
        nextStep:
          "After you finish a task, the page updates so the next class, learner, or workflow step can surface.",
      },
      STUDENT: {
        purpose:
          "This home page is your student command center for progress, reminders, and the next step in your portal journey.",
        firstStep:
          "Open the top next action first so you can handle the task that matters most right now.",
        nextStep:
          "After you complete a step, your progress updates and the next recommended action shows up automatically.",
      },
      PARENT: {
        purpose:
          "This home page is your family dashboard for student updates, reminders, and the next parent action that needs attention.",
        firstStep:
          "Look at the top action or newest alert first so you can respond to the most important family task.",
        nextStep:
          "After you review or complete the item, the next update or action appears in the same shared workflow.",
      },
    },
  },
  "/admin": {
    title: "Create Content",
    content: {
      purpose:
        "This workspace is only for approved content and structured setup tasks that belong in the portal.",
      firstStep:
        "Pick the content type you need from the dropdown so the page only shows the fields for that one task.",
      nextStep:
        "After you submit, the new content is created and the matching portal area is revalidated automatically.",
    },
  },
  "/admin/instructor-applicants": {
    title: "Instructor Applicants",
    content: {
      purpose:
        "This page is the shared hiring board for instructor applications from first review through final decision.",
      firstStep:
        "Open the left-most cards first, check the deadline to action, and confirm the reviewer and current notes before changing status.",
      nextStep:
        "When you score or move a card forward, the shared workflow record updates and the action moves to the next stage owner automatically.",
    },
  },
  "/messages": {
    title: "Messages",
    content: {
      purpose:
        "This page is your direct-message inbox for one-to-one and small-group conversations.",
      firstStep:
        "Open an unread conversation or start a new message to the specific person who needs the update.",
      nextStep:
        "Replies stay in the inbox and urgent message tasks also appear back on your home page.",
    },
  },
  "/notifications": {
    title: "Notifications",
    content: {
      purpose:
        "This page keeps a dated record of your portal alerts and the delivery rules behind them.",
      firstStep:
        "Read the unread items first, especially anything tied to hiring, reviews, or deadlines.",
      nextStep:
        "After you clear an alert, the archive stays here while your home page returns to the next active item.",
    },
  },
  "/onboarding": {
    title: "Onboarding",
    content: {
      purpose:
        "This page walks you through the setup steps you need before the rest of the portal opens up.",
      firstStep:
        "Work through the current step from top to bottom and save each answer before moving on.",
      nextStep:
        "When you finish the required steps, the portal marks onboarding complete and sends you to your next workspace.",
    },
    roleOverrides: {
      STUDENT: {
        purpose:
          "This page helps you set up your student profile, interests, and first direction inside the portal.",
        firstStep:
          "Complete the current student step carefully so your profile and recommendations start in the right place.",
        nextStep:
          "After you finish onboarding, the portal unlocks your next student actions and sends you to your main workspace.",
      },
      INSTRUCTOR: {
        purpose:
          "This page helps you finish instructor setup so your teaching tools and readiness steps open correctly.",
        firstStep:
          "Complete the current setup step and double-check anything tied to your class, chapter, or readiness work.",
        nextStep:
          "Once onboarding is complete, your instructor workspace and next required actions are ready to use.",
      },
      ADMIN: {
        purpose:
          "This page helps you complete the required setup before you start using admin workflows in the portal.",
        firstStep:
          "Move through each onboarding step in order so your access and setup information are complete.",
        nextStep:
          "When the final step is saved, the portal sends you into the admin workflow with the right access already in place.",
      },
    },
  },
  "/login": {
    title: "Login",
    content: {
      purpose:
        "This page helps you sign in to the portal safely so you can reach your saved work and next actions.",
      firstStep:
        "Enter your email and password carefully, or choose the sign-in option that matches the account you already use.",
      nextStep:
        "After you sign in successfully, the portal sends you to the right workspace based on your access and progress.",
    },
  },
  "/signup": {
    title: "Sign Up",
    content: {
      purpose:
        "This page helps you start your application or account setup in the format the portal expects.",
      firstStep:
        "Fill in the required fields from top to bottom and double-check your contact information before you continue.",
      nextStep:
        "After you submit, the portal saves your information and shows the next step for verification or review.",
    },
  },
  "/signup/parent": {
    title: "Parent Sign Up",
    content: {
      purpose:
        "This page helps a parent or guardian create the right account connection for family access in the portal.",
      firstStep:
        "Enter the family details carefully so the portal can connect the right student and parent records.",
      nextStep:
        "After you submit, the portal saves the parent signup and guides you to the next verification step.",
    },
  },
  "/forgot-password": {
    title: "Forgot Password",
    content: {
      purpose:
        "This page helps you start a secure password reset when you cannot sign in with your current password.",
      firstStep:
        "Enter the email address tied to your portal account so the reset message goes to the right place.",
      nextStep:
        "After you submit, check your email and use the reset link to choose a new password.",
    },
  },
  "/reset-password": {
    title: "Reset Password",
    content: {
      purpose:
        "This page lets you set a new password after you open a valid reset link from your email.",
      firstStep:
        "Type the new password carefully and confirm it so both fields match before you submit.",
      nextStep:
        "Once the reset is complete, you can sign in again with the new password.",
    },
  },
  "/verify-email": {
    title: "Verify Email",
    content: {
      purpose:
        "This page confirms whether your email verification link worked and what you should do next.",
      firstStep:
        "Read the verification result carefully so you know whether the address was confirmed or needs another try.",
      nextStep:
        "After verification succeeds, return to sign in or continue the next account step the page shows.",
    },
  },
  "/magic-link": {
    title: "Magic Link",
    content: {
      purpose:
        "This page handles sign-in through a one-time email link when you are not using a password.",
      firstStep:
        "Open the most recent magic link from your email and use it before it expires.",
      nextStep:
        "When the link is accepted, the portal signs you in and sends you to the right workspace automatically.",
    },
  },
  "/instructor/lesson-design-studio/print": {
    title: "Lesson Design Studio Print View",
    hidden: true,
  },
  "/world": {
    title: "Passion World",
    placement: "bottom-left",
  },
};

function walk(dir, pages = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, pages);
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      pages.push(fullPath);
    }
  }

  return pages;
}

function appPageFileToRoutePattern(filePath) {
  const relative = path.relative(APP_DIR, filePath).replace(/\\/g, "/");
  const withoutFile = relative.replace(/\/page\.tsx$/, "");
  const segments = withoutFile
    .split("/")
    .filter(Boolean)
    .filter((segment) => !ROUTE_GROUP_SEGMENT.test(segment));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/&amp;/g, "&")
    .replace(/\s+[—|-]\s+YPP.*$/i, "")
    .replace(/\s+\|\s+YPP.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractStaticTitle(source) {
  const metadataMatch =
    source.match(/export const metadata\s*=\s*\{\s*title:\s*"([^"]+)"/) ||
    source.match(/export const metadata\s*=\s*\{\s*title:\s*'([^']+)'/);
  if (metadataMatch?.[1] && !metadataMatch[1].includes("{")) {
    return cleanTitle(metadataMatch[1]);
  }

  const headingPatterns = [
    /<h1[^>]*className="page-title"[^>]*>\s*([^<{][^<]*)\s*<\/h1>/,
    /<h1[^>]*>\s*([^<{][^<]*)\s*<\/h1>/,
    /<h2[^>]*className="page-title"[^>]*>\s*([^<{][^<]*)\s*<\/h2>/,
  ];

  for (const pattern of headingPatterns) {
    const match = source.match(pattern);
    if (match?.[1] && !match[1].includes("{")) {
      return cleanTitle(match[1]);
    }
  }

  return null;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function singularize(word) {
  const lower = word.toLowerCase();
  if (COUNTABLE_WORD_OVERRIDES.has(lower)) {
    return COUNTABLE_WORD_OVERRIDES.get(lower);
  }

  if (lower.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }

  if (lower.endsWith("ses")) {
    return word.slice(0, -2);
  }

  if (lower.endsWith("s") && !lower.endsWith("ss")) {
    return word.slice(0, -1);
  }

  return word;
}

function humanizeSegment(segment) {
  if (!segment) return "Page";
  if (SEGMENT_LABELS.has(segment)) return SEGMENT_LABELS.get(segment);
  if (DYNAMIC_SEGMENT.test(segment)) return "Details";

  const cleaned = segment
    .replace(/^\[\.\.\.(.+)\]$/, "$1")
    .replace(/^\[\[(\.\.\..+)\]\]$/, "$1")
    .replace(/^\[(.+)\]$/, "$1")
    .replace(/-/g, " ");

  return titleCase(cleaned);
}

function deriveFallbackTitle(pattern) {
  if (pattern === "/") return "Portal Home";

  const segments = pattern.split("/").filter(Boolean);
  const last = segments.at(-1);
  const secondLast = segments.at(-2);
  const thirdLast = segments.at(-3);

  if (ACTION_SEGMENTS.has(last)) {
    const baseSegment = DYNAMIC_SEGMENT.test(secondLast ?? "")
      ? thirdLast
      : secondLast;
    return `${titleCase(last)} ${singularize(humanizeSegment(baseSegment))}`;
  }

  if (DYNAMIC_SEGMENT.test(last ?? "")) {
    return `${singularize(humanizeSegment(secondLast))} Details`;
  }

  if (DYNAMIC_SEGMENT.test(secondLast ?? "")) {
    return `${singularize(humanizeSegment(thirdLast))} ${humanizeSegment(last)}`;
  }

  return humanizeSegment(last);
}

function lowerTitle(title) {
  return title.toLowerCase();
}

function nounPhrase(title) {
  const lower = lowerTitle(title)
    .replace(/^(manage|create|submit|request|edit)\s+/i, "")
    .trim();
  if (/^(my|your|our|this|that|these|those)\b/.test(lower)) {
    return lower;
  }

  return `the ${lower}`;
}

function indefinitePhrase(title) {
  const lower = lowerTitle(title);
  const article = /^[aeiou]/.test(lower) ? "an" : "a";
  return `${article} ${lower}`;
}

function actionPhrase(title) {
  if (title.startsWith("Create ")) {
    return `creating ${indefinitePhrase(title.slice("Create ".length))}`;
  }

  if (title.startsWith("Submit ")) {
    return `submitting ${nounPhrase(title.slice("Submit ".length))}`;
  }

  if (title.startsWith("Request ")) {
    return `requesting ${nounPhrase(title.slice("Request ".length))}`;
  }

  if (title.startsWith("Apply ")) {
    return `applying for ${nounPhrase(title.slice("Apply ".length))}`;
  }

  if (title.startsWith("Share ")) {
    return `sharing ${nounPhrase(title.slice("Share ".length))}`;
  }

  if (title.startsWith("Edit ")) {
    return `editing ${nounPhrase(title.slice("Edit ".length))}`;
  }

  return `working through ${nounPhrase(title)}`;
}

function buildDashboardContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page gives you a clear view of ${subject} so you can spot what needs attention first.`,
    firstStep:
      "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
    nextStep:
      "After you review the current status, move into the matching record or workspace and take the next action from there.",
  };
}

function buildInboxContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page keeps ${subject} organized so you can respond without missing the next important update.`,
    firstStep:
      "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
    nextStep:
      "After you reply or mark the item complete, the list updates so the next item is easier to find.",
  };
}

function buildFormContent(title) {
  return {
    purpose: `This page walks you through ${actionPhrase(title)} in the format the portal expects.`,
    firstStep:
      "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
    nextStep:
      "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically.",
  };
}

function buildSettingsContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page lets you review and update ${subject} without leaving the portal.`,
    firstStep:
      "Read the current settings carefully so you know what is already saved before you change anything.",
    nextStep:
      "After you save an update, the new settings take effect in the part of the portal they control.",
  };
}

function buildCalendarContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page helps you see and plan ${subject} in one place.`,
    firstStep:
      "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
    nextStep:
      "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time.",
  };
}

function buildLibraryContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page helps you browse ${subject} and open the resource that fits your next task.`,
    firstStep:
      "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
    nextStep:
      "Once you find the right resource, open it and use the linked workspace or material to keep moving forward.",
  };
}

function buildReviewContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page helps you review ${subject} and move each item to the right next step.`,
    firstStep:
      "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
    nextStep:
      "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically.",
  };
}

function buildDetailContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page shows the full details for ${subject} so you can review the current state and act with context.`,
    firstStep:
      "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
    nextStep:
      "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up.",
  };
}

function buildManagementContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page helps you manage ${subject} and keep the portal data or workflow organized.`,
    firstStep:
      "Review the current list, board, or settings first so you can decide which item needs action right now.",
    nextStep:
      "After you save a change, the page refreshes the managed content so the next task is easier to track.",
  };
}

function buildHubContent(title) {
  const subject = nounPhrase(title);
  return {
    purpose: `This page brings together the main tools and details for ${subject}.`,
    firstStep:
      "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
    nextStep:
      "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option.",
  };
}

function chooseCategory(pattern, title) {
  const lowerPattern = pattern.toLowerCase();
  const lowerTitleValue = title.toLowerCase();

  if (
    pattern === "/" ||
    lowerPattern.endsWith("/home") ||
    lowerPattern.includes("dashboard") ||
    lowerTitleValue.includes("dashboard") ||
    lowerTitleValue.includes("command center")
  ) {
    return "dashboard";
  }

  if (
    /\/(new|create|submit|apply|propose|connect|share|nominate|edit)$/.test(lowerPattern) ||
    lowerTitleValue.startsWith("create ") ||
    lowerTitleValue.startsWith("submit ") ||
    lowerTitleValue.startsWith("request ") ||
    lowerTitleValue.startsWith("apply ")
  ) {
    return "form";
  }

  if (
    lowerPattern.includes("/messages") ||
    lowerPattern.includes("/chat") ||
    lowerPattern.includes("notification") ||
    lowerTitleValue.includes("message") ||
    lowerTitleValue.includes("notification")
  ) {
    return "inbox";
  }

  if (
    lowerPattern.includes("/calendar") ||
    lowerPattern.includes("/schedule") ||
    lowerPattern.includes("/meetings") ||
    lowerPattern.includes("office-hours") ||
    lowerTitleValue.includes("calendar") ||
    lowerTitleValue.includes("schedule")
  ) {
    return "calendar";
  }

  if (
    lowerPattern.includes("/settings") ||
    lowerTitleValue.includes("settings") ||
    lowerTitleValue.includes("security") ||
    lowerTitleValue.includes("personalization")
  ) {
    return "settings";
  }

  if (
    lowerPattern.includes("analytics") ||
    lowerPattern.includes("reports") ||
    lowerPattern.includes("history") ||
    lowerPattern.includes("leaderboard") ||
    lowerPattern.includes("tracking") ||
    lowerPattern.includes("streak") ||
    lowerPattern.includes("/progress") ||
    lowerTitleValue.includes("analytics") ||
    lowerTitleValue.includes("report") ||
    lowerTitleValue.includes("history")
  ) {
    return "dashboard";
  }

  if (
    lowerPattern.includes("review") ||
    lowerPattern.includes("approval") ||
    lowerPattern.includes("applicant") ||
    lowerPattern.includes("application") ||
    lowerPattern.includes("feedback") ||
    lowerPattern.includes("queue") ||
    lowerPattern.includes("audit-log") ||
    lowerTitleValue.includes("review") ||
    lowerTitleValue.includes("approval") ||
    lowerTitleValue.includes("feedback")
  ) {
    return "review";
  }

  if (
    lowerPattern.includes("resource") ||
    lowerPattern.includes("template") ||
    lowerPattern.includes("library") ||
    lowerPattern.includes("bookmark")
  ) {
    return "library";
  }

  if (lowerPattern.includes("[") || lowerPattern.endsWith("/edit")) {
    return "detail";
  }

  if (lowerPattern.startsWith("/admin")) {
    return "management";
  }

  return "hub";
}

function buildGeneratedContent(pattern, title) {
  switch (chooseCategory(pattern, title)) {
    case "dashboard":
      return buildDashboardContent(title);
    case "inbox":
      return buildInboxContent(title);
    case "form":
      return buildFormContent(title);
    case "settings":
      return buildSettingsContent(title);
    case "calendar":
      return buildCalendarContent(title);
    case "library":
      return buildLibraryContent(title);
    case "review":
      return buildReviewContent(title);
    case "detail":
      return buildDetailContent(title);
    case "management":
      return buildManagementContent(title);
    default:
      return buildHubContent(title);
  }
}

function serialize(value, indent = 0) {
  const space = "  ".repeat(indent);
  const nextSpace = "  ".repeat(indent + 1);

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((item) => `${nextSpace}${serialize(item, indent + 1)}`).join(",\n")}\n${space}]`;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  if (entries.length === 0) return "{}";

  return `{\n${entries
    .map(([key, entryValue]) => `${nextSpace}${key}: ${serialize(entryValue, indent + 1)}`)
    .join(",\n")}\n${space}}`;
}

const pageFiles = walk(APP_DIR).sort();

const registryEntries = pageFiles
  .map((filePath) => {
    const pattern = appPageFileToRoutePattern(filePath);
    const source = fs.readFileSync(filePath, "utf8");
    const override = ENTRY_OVERRIDES[pattern] ?? {};
    const title = override.title ?? extractStaticTitle(source) ?? deriveFallbackTitle(pattern);

    return {
      pattern,
      title,
      content: override.content ?? buildGeneratedContent(pattern, title),
      roleOverrides: override.roleOverrides,
      hidden: override.hidden,
      placement: override.placement,
    };
  })
  .sort((left, right) => left.pattern.localeCompare(right.pattern));

const output = `import type { PageHelperEntry } from "@/lib/page-helper/types";

export const PAGE_HELP_ENTRIES: PageHelperEntry[] = ${serialize(registryEntries, 0)};
`;

fs.writeFileSync(REGISTRY_PATH, output);
console.log(`Generated ${registryEntries.length} page helper entries.`);
