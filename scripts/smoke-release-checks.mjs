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
