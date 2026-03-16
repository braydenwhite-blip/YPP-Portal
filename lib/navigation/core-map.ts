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
  "APPLICANT",
];

export const CORE_NAV_MAP: Record<NavRole, string[]> = {
  APPLICANT: [
    "/",
    "/application-status",
    "/notifications",
  ],
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
    "/instructor-training",
    "/attendance",
    "/instructor/parent-feedback",
    "/mentorship",
    "/my-program/awards",
    "/messages",
    "/notifications",
  ],
  ADMIN: [
    "/",
    "/admin",
    "/admin/portal-rollout",
    "/admin/instructor-applicants",
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
    "/chapter-lead/instructor-applicants",
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
