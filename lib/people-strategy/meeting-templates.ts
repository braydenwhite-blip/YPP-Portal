import type { MeetingCategory } from "./meeting-categories";
import type { MeetingType } from "./meeting-operating-model";

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
  meetingType: MeetingType;
  category: MeetingCategory;
  purpose: string;
  /** Default meeting length in minutes (seeds the end time in the form). */
  durationMinutes: number;
  recurrence: "WEEKLY" | "NONE";
  agenda: string[];
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "t_officer",
    name: "Officer Meeting",
    meetingType: "OFFICER_MEETING",
    category: "LEADERSHIP",
    purpose:
      "Weekly decision-focused meeting for strategy, applicants, staff performance, escalations, and ownership gaps.",
    durationMinutes: 60,
    recurrence: "WEEKLY",
    agenda: [
      "Decisions needed this week",
      "Escalations from Impact Presentations",
      "Applicants needing review",
      "Staff performance concerns",
      "Overdue strategic actions",
      "People needing intervention",
      "Role ownership gaps",
      "Upcoming priorities",
      "Last week's commitments still open",
    ],
  },
  {
    id: "t_global_impact",
    name: "Global Operations Impact Presentation",
    meetingType: "GLOBAL_OPERATIONS_IMPACT_PRESENTATION",
    category: "OPERATIONS",
    purpose:
      "Weekly accountability forum where Tech, Fundraising, Expansion, and Socials show progress, proof, blockers, decisions, and next commitments.",
    durationMinutes: 90,
    recurrence: "WEEKLY",
    agenda: [
      "Tech: portal updates, bugs fixed, features shipped, data/automation, testing blockers",
      "Fundraising: outreach completed, donor/sponsor progress, materials, responses, decisions",
      "Expansion: new areas contacted, parent/alumni outreach, chapter leads, partner conversations",
      "Socials: posts created/scheduled, campaign results, approvals needed, upcoming content",
      "Leadership decisions and follow-up actions",
      "Attendance or responsiveness concerns",
    ],
  },
  {
    id: "t_chapter_impact",
    name: "Chapter Impact Presentation",
    meetingType: "CHAPTER_IMPACT_PRESENTATION",
    category: "CHAPTERS",
    purpose:
      "Weekly chapter accountability meeting for presidents to present progress, outreach, blockers, decisions, and next steps.",
    durationMinutes: 60,
    recurrence: "WEEKLY",
    agenda: [
      "Chapter progress this week",
      "New partners or outreach",
      "New applicants or students",
      "Current blockers",
      "Decisions needed",
      "Next week's commitments",
      "Follow-up actions",
      "Attendance or responsiveness concerns",
    ],
  },
  {
    id: "t_mentor_checkin",
    name: "Mentorship Check-in",
    meetingType: "MENTORSHIP_CHECK_IN",
    category: "MENTORSHIP",
    purpose: "Mentor and mentee check-in for goals, progress, notes, next steps, and review history.",
    durationMinutes: 30,
    recurrence: "WEEKLY",
    agenda: ["Goals", "Progress", "Blockers", "Next steps", "Related actions", "Review history"],
  },
  {
    id: "t_mentor_kickoff",
    name: "Mentor Kickoff",
    meetingType: "MENTOR_KICKOFF_MEETING",
    category: "MENTORSHIP",
    purpose:
      "First mentor and mentee meeting to set expectations, goals, communication cadence, and first next steps.",
    durationMinutes: 45,
    recurrence: "NONE",
    agenda: [
      "Introductions and support roles",
      "Mentee goals and current commitments",
      "Meeting cadence and communication preferences",
      "Known blockers or support needs",
      "First next steps",
    ],
  },
  {
    id: "t_monthly_checkin",
    name: "Monthly Check-in",
    meetingType: "MONTHLY_CHECK_IN",
    category: "MENTORSHIP",
    purpose:
      "Monthly check-in for self-reflection, feedback, current work, rating, sign-off, and next-step actions.",
    durationMinutes: 30,
    recurrence: "NONE",
    agenda: [
      "Self-reflection status",
      "Feedback gathered",
      "Current work and missed work",
      "Goal progress and wellbeing notes",
      "Rating and next steps",
      "Actions created from this check-in",
    ],
  },
  {
    id: "t_quarterly_mentor_review",
    name: "Quarterly Mentor Committee Review",
    meetingType: "QUARTERLY_MENTOR_COMMITTEE_REVIEW",
    category: "MENTORSHIP",
    purpose:
      "Quarterly review connecting monthly check-ins, action history, feedback, mentor recommendations, ratings, decisions, and follow-up actions.",
    durationMinutes: 60,
    recurrence: "NONE",
    agenda: [
      "Monthly check-in evidence",
      "Action history and missed work",
      "Feedback and mentor recommendation",
      "Performance and potential ratings",
      "Pathway decision",
      "Updated goals and follow-up actions",
    ],
  },
  {
    id: "t_class",
    name: "Classes Operations Check-In",
    meetingType: "GENERAL_MEETING",
    category: "CLASSES",
    purpose: "Classes operating check-in for coverage, readiness, communication, and launch decisions.",
    durationMinutes: 45,
    recurrence: "WEEKLY",
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
    meetingType: "GENERAL_MEETING",
    category: "INSTRUCTORS",
    purpose: "Instructor accountability review for readiness, activity, training, and recognition.",
    durationMinutes: 30,
    recurrence: "WEEKLY",
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
    meetingType: "MENTORSHIP_CHECK_IN",
    category: "MENTORSHIP",
    purpose: "Mentorship pipeline review for matches, inactive relationships, ratings, and escalations.",
    durationMinutes: 45,
    recurrence: "WEEKLY",
    agenda: ["Unmatched mentees", "Inactive mentors", "Ratings / points issues", "Escalations"],
  },
  {
    id: "t_chap",
    name: "Chapter Growth Meeting",
    meetingType: "CHAPTER_IMPACT_PRESENTATION",
    category: "CHAPTERS",
    purpose: "Chapter growth meeting for chapter applications, president check-ins, and expansion priorities.",
    durationMinutes: 45,
    recurrence: "WEEKLY",
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
    meetingType: "GENERAL_MEETING",
    category: "PARTNERSHIPS",
    purpose: "Partnership outreach review for partner leads, follow-up emails, and local opportunities.",
    durationMinutes: 30,
    recurrence: "WEEKLY",
    agenda: ["Camp outreach", "Follow-up emails", "Local org opportunities"],
  },
  {
    id: "t_app",
    name: "Application Review Meeting",
    meetingType: "OFFICER_MEETING",
    category: "APPLICATIONS",
    purpose: "Application review meeting for backlog, interviews, decisions, and next steps.",
    durationMinutes: 45,
    recurrence: "WEEKLY",
    agenda: ["Application backlog", "Shortlist & interviews", "Decisions"],
  },
  {
    id: "t_applicant_interview",
    name: "Applicant Interview",
    meetingType: "APPLICANT_INTERVIEW",
    category: "APPLICATIONS",
    purpose:
      "Structured applicant interview for stage, submitted evidence, interviewer notes, concerns, recommendation, and next step.",
    durationMinutes: 30,
    recurrence: "NONE",
    agenda: [
      "Applicant identity and current stage",
      "Interview questions",
      "Submitted review evidence",
      "Concerns or flags",
      "Recommended next step",
      "Follow-up actions",
    ],
  },
  {
    id: "t_instructor_applicant_interview",
    name: "Instructor Applicant Interview",
    meetingType: "INSTRUCTOR_APPLICANT_INTERVIEW",
    category: "APPLICATIONS",
    purpose:
      "Instructor applicant interview focused on teaching readiness, curriculum thinking, concerns, recommendation, and final decision inputs.",
    durationMinutes: 30,
    recurrence: "NONE",
    agenda: [
      "Applicant stage and current decision needed",
      "Teaching motivation and availability",
      "Curriculum or class idea discussion",
      "Scores, notes, and concerns",
      "Recommended next step",
      "Follow-up actions",
    ],
  },
  {
    id: "t_tech",
    name: "Technology / Product Sync",
    meetingType: "GLOBAL_OPERATIONS_IMPACT_PRESENTATION",
    category: "TECHNOLOGY",
    purpose: "Technology impact sync for development, testing, rollout, data infrastructure, and automation.",
    durationMinutes: 30,
    recurrence: "WEEKLY",
    agenda: ["Roadmap", "Open bugs", "Integrations", "Releases this week"],
  },
  {
    id: "t_blank",
    name: "Blank meeting",
    meetingType: "GENERAL_MEETING",
    category: "OTHER",
    purpose: "",
    durationMinutes: 30,
    recurrence: "NONE",
    agenda: [],
  },
];

export function findMeetingTemplate(id: string): MeetingTemplate | undefined {
  return MEETING_TEMPLATES.find((t) => t.id === id);
}
