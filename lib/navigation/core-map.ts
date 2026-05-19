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
    "/messages",
  ],
  STUDENT: [
    "/",
    "/my-chapter",
    "/curriculum",
    "/my-program",
    "/pathways",
    "/my-classes",
    "/events",
    "/messages",
  ],
  INSTRUCTOR: [
    "/",
    "/instructor-training",
    "/instructor/lesson-design-studio",
    "/attendance",
    "/instructor/parent-feedback",
    "/my-program",
    "/scheduling",
    "/messages",
  ],
  ADMIN: [
    "/",
    "/admin",
    "/messages",
    "/goals",
    "/my-program",
    "/positions",
    "/mentorship",
    "/attendance",
  ],
  HIRING_CHAIR: [
    "/",
    "/admin/instructor-applicants/chair-queue",
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
  ],
  CHAPTER_PRESIDENT: [
    // "Shortcuts" row above the grouped CP sidebar. Everything else is
    // organized into groups by chapter-president-v1-nav-layout.ts.
    "/",
    "/chapter",
  ],
  MENTOR: [
    "/",
    "/mentorship",
    "/mentorship/mentees",
    "/mentor/resources",
    "/office-hours",
    "/events",
    "/messages",
  ],
  STAFF: [
    "/",
    "/announcements",
    "/calendar",
    "/goals",
    "/positions",
    "/applications",
    "/messages",
  ],
};
