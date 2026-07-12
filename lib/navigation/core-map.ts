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
    "/instructor/classes",
    "/instructor/students",
    "/instructor/materials",
    "/instructor/schedule",
  ],
  ADMIN: ["/", "/people", "/actions", "/admin/instructor-applicants"],
  HIRING_CHAIR: ["/", "/people", "/actions", "/admin/instructor-applicants"],
  PARENT: ["/", "/parent", "/parent/resources", "/calendar", "/parent/connect", "/goals"],
  CHAPTER_PRESIDENT: ["/", "/people", "/actions", "/chapter-lead/instructor-applicants"],
  MENTOR: ["/", "/mentorship", "/mentorship/mentees", "/mentorship/schedule", "/office-hours"],
  STAFF: ["/", "/people", "/actions", "/admin/instructor-applicants"],
};
