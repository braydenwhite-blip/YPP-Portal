import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const fileChecks = [
  {
    id: "interviews-route",
    description: "Interviews command center route exists",
    file: "app/(app)/interviews/page.tsx",
  },
  {
    id: "activities-api",
    description: "Activities completion API exists",
    file: "app/api/activities/complete/route.ts",
  },
  {
    id: "projects-api",
    description: "Project creation API exists",
    file: "app/api/projects/create/route.ts",
  },
  {
    id: "gates-lib",
    description: "Feature gate service exists",
    file: "lib/feature-gates.ts",
  },
  {
    id: "workflow-matrix-doc",
    description: "Portal reliability matrix exists",
    file: "docs/portal-reliability-matrix.md",
  },
  {
    id: "admin-portal-analytics-lib",
    description: "Admin portal analytics data layer exists",
    file: "lib/admin-portal-analytics.ts",
  },
  {
    id: "playwright-config",
    description: "Playwright configuration exists",
    file: "playwright.config.ts",
  },
  {
    id: "e2e-seed-script",
    description: "Dedicated E2E seed script exists",
    file: "scripts/seed-portal-e2e.ts",
  },
];

const contentChecks = [
  {
    id: "interview-slots-skip-duplicates",
    description: "Interview slot bulk posting is duplicate-safe",
    file: "lib/instructor-interview-actions.ts",
    pattern: "skipDuplicates: true",
  },
  {
    id: "activities-rate-limit",
    description: "Activities completion endpoint applies rate limiting",
    file: "app/api/activities/complete/route.ts",
    pattern: "checkRateLimit(",
  },
  {
    id: "activities-idempotency",
    description: "Activities completion endpoint uses completion idempotency",
    file: "app/api/activities/complete/route.ts",
    pattern: "activityCompletion",
  },
  {
    id: "projects-safe-redirect",
    description: "Project create API uses NextResponse redirect path",
    file: "app/api/projects/create/route.ts",
    pattern: "NextResponse.redirect(",
  },
  {
    id: "chapter-feature-gating-activities",
    description: "Activities page checks feature gates",
    file: "app/(app)/activities/page.tsx",
    pattern: "isFeatureEnabledForUser(",
  },
  {
    id: "analytics-dashboard-uses-new-source",
    description: "Admin analytics page uses the portal analytics source",
    file: "app/(app)/admin/analytics/page.tsx",
    pattern: "getAdminPortalAnalytics(",
  },
  {
    id: "admin-instructor-applicants-page",
    description: "Admin instructor applicants page loads the command center",
    file: "app/(app)/admin/instructor-applicants/page.tsx",
    pattern: "InstructorApplicantsCommandCenter",
  },
  {
    id: "admin-chapter-president-applicants-page",
    description: "Admin chapter president applicants page uses the kanban pipeline",
    file: "app/(app)/admin/chapter-president-applicants/page.tsx",
    pattern: "chapterPresidentApplication",
  },
];

const failures = [];

for (const check of fileChecks) {
  const target = path.join(root, check.file);
  if (!existsSync(target)) {
    failures.push(`${check.id}: ${check.description} (missing ${check.file})`);
  }
}

for (const check of contentChecks) {
  const target = path.join(root, check.file);
  if (!existsSync(target)) {
    failures.push(`${check.id}: ${check.description} (missing ${check.file})`);
    continue;
  }
  const content = readFileSync(target, "utf8");
  if (!content.includes(check.pattern)) {
    failures.push(
      `${check.id}: ${check.description} (expected pattern "${check.pattern}" not found in ${check.file})`
    );
  }
}

if (failures.length > 0) {
  console.error("Release smoke checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Release smoke checks passed.");
