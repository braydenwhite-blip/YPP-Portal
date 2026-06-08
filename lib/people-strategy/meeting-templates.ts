import type { MeetingCategory } from "./meeting-categories";

/**
 * People Strategy — Meeting templates for the New Meeting flow.
 *
 * Pre-fill the create form (title, category, duration, agenda) so common YPP
 * leadership meetings don't start from a blank page. Pure value module (no
 * Prisma, no "use server") shared by the form and unit-tested directly. Mirrors
 * the approved design's `TEMPLATES`.
 */

export interface MeetingTemplate {
  id: string;
  name: string;
  category: MeetingCategory;
  /** Default meeting length in minutes (seeds the end time in the form). */
  durationMinutes: number;
  agenda: string[];
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "t_lead",
    name: "Weekly Leadership Sync",
    category: "LEADERSHIP",
    durationMinutes: 60,
    agenda: [
      "Review overdue action items",
      "Department updates",
      "Blockers & escalations",
      "Priorities for the week",
      "Decisions needed",
    ],
  },
  {
    id: "t_class",
    name: "Classes Operations Check-In",
    category: "CLASSES",
    durationMinutes: 45,
    agenda: [
      "Classes missing instructors",
      "Signup numbers by course",
      "Instructor readiness",
      "Parent / student communication",
      "Low-enrollment decisions",
    ],
  },
  {
    id: "t_instr",
    name: "Instructor Accountability Review",
    category: "INSTRUCTORS",
    durationMinutes: 30,
    agenda: [
      "Missing bios & descriptions",
      "No-show / inactive instructors",
      "Training completion",
      "Recognition & shoutouts",
    ],
  },
  {
    id: "t_mentor",
    name: "Mentorship Pipeline Review",
    category: "MENTORSHIP",
    durationMinutes: 45,
    agenda: ["Unmatched mentees", "Inactive mentors", "Ratings / points issues", "Escalations"],
  },
  {
    id: "t_chap",
    name: "Chapter Growth Meeting",
    category: "CHAPTERS",
    durationMinutes: 45,
    agenda: [
      "New chapter applications",
      "Existing chapter activity",
      "Lead check-ins",
      "Expansion priorities",
    ],
  },
  {
    id: "t_part",
    name: "Partnership Outreach Review",
    category: "PARTNERSHIPS",
    durationMinutes: 30,
    agenda: ["Camp outreach", "Follow-up emails", "Local org opportunities"],
  },
  {
    id: "t_app",
    name: "Application Review Meeting",
    category: "APPLICATIONS",
    durationMinutes: 45,
    agenda: ["Application backlog", "Shortlist & interviews", "Decisions"],
  },
  {
    id: "t_tech",
    name: "Technology / Product Sync",
    category: "TECHNOLOGY",
    durationMinutes: 30,
    agenda: ["Roadmap", "Open bugs", "Integrations", "Releases this week"],
  },
  {
    id: "t_blank",
    name: "Blank meeting",
    category: "OTHER",
    durationMinutes: 30,
    agenda: [],
  },
];

export function findMeetingTemplate(id: string): MeetingTemplate | undefined {
  return MEETING_TEMPLATES.find((t) => t.id === id);
}
