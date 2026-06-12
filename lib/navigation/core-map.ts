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
    "/instructor-onboarding",
    "/instructor-training",
    "/instructor/lesson-design-studio",
    "/attendance",
    "/instructor/parent-feedback",
    "/my-mentor",
    "/scheduling",
    "/messages",
  ],
  ADMIN: [
    // Knowledge OS V2 leadership pins (plan §20): Home, Admin home, the two
    // master-database front doors, and the Work Hub lead; /positions joined
    // /goals and /my-program in "More Tools" to stay within the 8-pin cap.
    "/",
    "/admin",
    "/people",
    "/work",
    "/partners",
    "/messages",
    "/admin/mentorship",
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
    "/office-hours",
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
