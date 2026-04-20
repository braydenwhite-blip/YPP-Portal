import { normalizeRoleValue } from "@/lib/role-utils";

export const DEMO_ALLOWED_PREFIXES = [
  "/",
  "/application-status",
  "/positions",
  "/applications",
  "/interviews",
  "/instructor/lesson-design-studio",
  "/admin/applications",
  "/admin/recruiting",
  "/admin/hiring-committee",
  "/admin/instructor-applicants",
  "/admin/chapter-president-applicants",
  "/admin/positions",
  "/chapter-lead/instructor-applicants",
  "/not-rolled-out",
  "/onboarding",
];

export function isHiringDemoModeEnabled() {
  return (
    process.env.HIRING_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_HIRING_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

export function isDemoAllowedPathname(pathname: string): boolean {
  return DEMO_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getHiringDemoHomeHref(input: {
  primaryRole?: string | null;
  roles?: string[] | null;
}) {
  const roles = new Set(
    (input.roles ?? [])
      .map((role) => normalizeRoleValue(role))
      .filter((role): role is string => Boolean(role))
  );
  const primaryRole = normalizeRoleValue(input.primaryRole ?? null);

  if (primaryRole) {
    roles.add(primaryRole);
  }

  if (roles.has("ADMIN")) {
    return "/admin/instructor-applicants";
  }

  if (roles.has("CHAPTER_PRESIDENT")) {
    return "/chapter-lead/instructor-applicants";
  }

  return "/application-status";
}
