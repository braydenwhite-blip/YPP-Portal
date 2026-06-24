import type { NavRole } from "@/lib/navigation/types";

export const CORE_NAV_LIMIT = 8;

export const PRIMARY_ROLE_FALLBACK_ORDER: NavRole[] = [
  "ADMIN",
  "HIRING_CHAIR",
  "CHAPTER_PRESIDENT",
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
    "/instructor-training",
    "/instructor/lesson-design-studio",
    "/positions",
    "/applications",
  ],
  STUDENT: [
    "/",
    "/my-chapter",
    "/curriculum",
    "/my-program",
    "/pathways",
    "/my-classes",
    "/events",
  ],
  INSTRUCTOR: [
    "/",
    "/instructor-onboarding",
    "/instructor-training",
    "/instructor/lesson-design-studio",
    "/attendance",
    "/instructor/parent-feedback",
    "/my-mentor",
  ],
  ADMIN: [
    "/",
    "/people",
    "/actions",
    "/meetings",
  ],
  HIRING_CHAIR: [
    "/",
    "/admin/instructor-applicants",
    "/admin/instructor-applicants/chair-queue",
    "/people",
    "/actions",
    "/meetings",
  ],
  PARENT: [
    "/",
    "/parent",
    "/parent/resources",
    "/calendar",
    "/parent/connect",
    "/goals",
  ],
  CHAPTER_PRESIDENT: [
    "/",
    "/chapter",
    "/people",
    "/actions",
  ],
  MENTOR: [
    "/",
    "/mentorship",
    "/mentorship/mentees",
    "/office-hours",
  ],
  STAFF: [
    "/",
    "/people",
    "/actions",
    "/meetings",
  ],
};
