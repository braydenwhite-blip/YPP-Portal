import type { NavRole } from "@/lib/navigation/types";

export const CORE_NAV_LIMIT = 8;

export const PRIMARY_ROLE_FALLBACK_ORDER: NavRole[] = [
  "ADMIN",
  "CHAPTER_LEAD",
  "INSTRUCTOR",
  "MENTOR",
  "PARENT",
  "STUDENT",
  "STAFF",
];

export const CORE_NAV_MAP: Record<NavRole, string[]> = {
  STUDENT: [
    "/",
    "/activities",
    "/challenges",
    "/incubator",
    "/pathways",
    "/my-courses",
    "/goals",
    "/messages"
  ],
  INSTRUCTOR: [
    "/",
    "/instructor/workspace",
    "/instructor/class-settings",
    "/lesson-plans",
    "/instructor-training",
    "/attendance",
    "/instructor/mentee-health",
    "/messages",
  ],
  ADMIN: [
    "/",
    "/admin",
    "/admin/portal-rollout",
    "/admin/applications",
    "/admin/instructor-readiness",
    "/admin/waitlist",
    "/admin/students",
    "/messages",
  ],
  PARENT: [
    "/",
    "/parent",
    "/parent/resources",
    "/calendar",
    "/parent/connect",
    "/goals",
    "/messages",
    "/notifications",
  ],
  CHAPTER_LEAD: [
    "/",
    "/chapter-lead/dashboard",
    "/chapter-lead/portal-rollout",
    "/chapter/recruiting",
    "/chapter-lead/instructor-readiness",
    "/chapter",
    "/attendance",
    "/messages",
  ],
  MENTOR: [
    "/",
    "/mentorship",
    "/mentorship/mentees",
    "/mentor/resources",
    "/office-hours",
    "/events",
    "/messages",
    "/notifications",
  ],
  STAFF: [
    "/",
    "/announcements",
    "/calendar",
    "/goals",
    "/positions",
    "/applications",
    "/messages",
    "/notifications",
  ],
};
