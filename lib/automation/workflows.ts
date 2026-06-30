// ============================================================================
// WORKFLOW RECIPE REGISTRY (Phase 6)
// ============================================================================
//
// Declarative definitions of the multi-step operating workflows the automation
// brain models. A recipe is reference data — it documents the stages, triggers,
// the automation item types each workflow generates, how items resolve, when
// they escalate, meeting relevance, and the default owner. The UI uses recipes
// to GROUP items by workflow and explain why each exists; the rules/normalizers
// emit the item types named here. Pure data, no runtime behavior.

import type {
  AutomationWorkflow,
  AutomationItemType,
  AutomationEntityType,
  ImpactMeetingRelevance,
} from "@/lib/automation/types";

export type WorkflowRecipe = {
  id: string;
  name: string;
  description: string;
  /** The lane this recipe belongs to. */
  workflow: AutomationWorkflow;
  entityType: AutomationEntityType;
  /** Ordered stages of the process. */
  stages: string[];
  /** Conditions that advance the workflow / generate items. */
  triggers: string[];
  /** Automation item types this workflow can generate. */
  generatedItemTypes: AutomationItemType[];
  /** How items in this workflow resolve. */
  resolutionConditions: string[];
  /** When work in this workflow escalates to global leadership. */
  escalationConditions: string[];
  meetingRelevance: ImpactMeetingRelevance;
  /** Who owns the work by default. */
  defaultOwnerRule: string;
};

export const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    id: "partner_outreach",
    name: "Partner Outreach Workflow",
    description: "Research organizations, reach out, and follow up until they respond.",
    workflow: "PARTNERS",
    entityType: "PARTNER",
    stages: ["researched", "contacted", "follow-up due", "responded"],
    triggers: ["partner added", "outreach logged", "5–7 business days since contact with no response"],
    generatedItemTypes: ["PARTNER_RESEARCH_NOT_STARTED", "PARTNER_OUTREACH_BELOW_TARGET", "PARTNER_FOLLOW_UP_DUE"],
    resolutionConditions: ["a response is logged", "the next follow-up date is set", "the partner advances stage"],
    escalationConditions: ["no responses after sustained outreach by Week 4"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president (or partner relationship lead)",
  },
  {
    id: "partner_meeting",
    name: "Partner Meeting Workflow",
    description: "Prepare for, hold, and follow up on partner meetings.",
    workflow: "PARTNERS",
    entityType: "PARTNER",
    stages: ["meeting scheduled", "meeting prep due", "meeting completed", "outcome missing", "follow-up due", "next step scheduled"],
    triggers: ["meetingDate exists", "meeting within 24h", "meeting date passed with no outcome note", "outcome exists but no next follow-up"],
    generatedItemTypes: ["PARTNER_MEETING_OUTCOME_MISSING", "PARTNER_FOLLOW_UP_DUE"],
    resolutionConditions: ["a meeting outcome note is logged", "a post-meeting follow-up is scheduled"],
    escalationConditions: ["outcome missing > 24h", "follow-up missing > 24h"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "partner_relationship_maintenance",
    name: "Partner Relationship Maintenance Workflow",
    description: "Keep confirmed partners healthy with logistics and weekly check-ins.",
    workflow: "PARTNERS",
    entityType: "PARTNER",
    stages: ["confirmed", "logistics in writing", "weekly check-in", "issue resolution"],
    triggers: ["partner confirmed with incomplete logistics", "no weekly check-in during live ops", "open partner issue"],
    generatedItemTypes: ["PARTNER_LOGISTICS_INCOMPLETE", "PARTNER_WEEKLY_CHECKIN_DUE", "PARTNER_ISSUE_UNRESOLVED"],
    resolutionConditions: ["written logistics complete", "check-in logged", "issue closed"],
    escalationConditions: ["partner issue unresolved > 24h"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "instructor_recruiting",
    name: "Instructor Recruiting Workflow",
    description: "Open applications and grow the applicant pool toward ~25.",
    workflow: "INSTRUCTORS",
    entityType: "INSTRUCTOR_APPLICATION",
    stages: ["recruiting started", "applications coming in", "pool target"],
    triggers: ["no applications by Week 2", "applicant count below week target"],
    generatedItemTypes: ["INSTRUCTOR_RECRUITING_NOT_STARTED", "INSTRUCTOR_OUTREACH_BELOW_TARGET"],
    resolutionConditions: ["applicant counts reach the week's target"],
    escalationConditions: ["applicant pool far below target near hiring deadline"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president / hiring chair",
  },
  {
    id: "instructor_interview",
    name: "Instructor Interview Workflow",
    description: "Review applications, schedule interviews, and submit decisions on time.",
    workflow: "INSTRUCTORS",
    entityType: "INSTRUCTOR_APPLICATION",
    stages: ["application review", "interview scheduling", "interview", "decision"],
    triggers: ["application waiting for review", "approved-to-interview but unscheduled", "interview done, decision past 12h SLA"],
    generatedItemTypes: ["INSTRUCTOR_APPLICATION_REVIEW_DUE", "INSTRUCTOR_INTERVIEW_UNSCHEDULED", "INSTRUCTOR_INTERVIEW_DECISION_DUE"],
    resolutionConditions: ["reviewer assigned & reviewed", "interview scheduled", "decision recorded"],
    escalationConditions: ["interview decision overdue repeatedly"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "reviewer / hiring chair",
  },
  {
    id: "instructor_orientation",
    name: "Instructor Orientation Workflow",
    description: "Bring hired instructors through orientation and assignment confirmation.",
    workflow: "INSTRUCTORS",
    entityType: "INSTRUCTOR_APPLICATION",
    stages: ["hired", "orientation", "assigned", "assignment confirmed", "readiness check"],
    triggers: ["hired without orientation", "assigned but unconfirmed", "readiness check missing near launch"],
    generatedItemTypes: ["INSTRUCTOR_ORIENTATION_MISSING", "INSTRUCTOR_ASSIGNMENT_UNCONFIRMED", "INSTRUCTOR_READINESS_CHECK_DUE"],
    resolutionConditions: ["orientation logged", "assignment confirmed", "readiness check complete"],
    escalationConditions: ["instructor not ready within pre-launch window"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "curriculum_approval",
    name: "Curriculum Approval Workflow",
    description: "Two-stage approval: submission → CP review → global review → approved.",
    workflow: "CURRICULUM",
    entityType: "CURRICULUM",
    stages: ["not submitted", "CP review", "CP approved", "global review", "fully approved", "revision"],
    triggers: ["no submission", "CP review > 48h SLA", "CP approved (ready for global)", "revision requested"],
    generatedItemTypes: ["CURRICULUM_SUBMISSION_MISSING", "CURRICULUM_REVIEW_DUE", "CURRICULUM_GLOBAL_REVIEW_READY", "CURRICULUM_REVISION_OVERDUE"],
    resolutionConditions: ["the stage advances per the two-stage state machine"],
    escalationConditions: ["CP review severely overdue", "global review blocking launch"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president (CP review) / global leadership (global review)",
  },
  {
    id: "class_schedule_readiness",
    name: "Class Schedule Readiness Workflow",
    description: "Get every class to a launch-ready, public listing.",
    workflow: "CLASSES",
    entityType: "CLASS_OFFERING",
    stages: ["created", "instructor", "location", "time", "launch date", "public", "ready"],
    triggers: ["class missing instructor/location/time/launch date", "not public near launch", "pre-launch reminder not sent"],
    generatedItemTypes: ["CLASS_MISSING_INSTRUCTOR", "CLASS_MISSING_LOCATION", "CLASS_MISSING_TIME", "LAUNCH_DATE_MISSING", "CLASS_NOT_PUBLIC", "PRE_LAUNCH_REMINDER_DUE"],
    resolutionConditions: ["the missing field is filled", "the class is published", "the reminder is sent"],
    escalationConditions: ["class not launch-ready inside the pre-launch window"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "student_recruitment",
    name: "Student Recruitment Workflow",
    description: "Advertise and drive enrollment to target before launch.",
    workflow: "ENROLLMENT",
    entityType: "CLASS_OFFERING",
    stages: ["advertising", "enrolling", "target reached"],
    triggers: ["public class with no enrollment", "advertising channel missing"],
    generatedItemTypes: ["ADVERTISING_NOT_STARTED", "ADVERTISING_CHANNEL_MISSING"],
    resolutionConditions: ["enrollment grows", "advertising activity logged"],
    escalationConditions: ["no enrollment movement near launch"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "enrollment_rescue",
    name: "Enrollment Rescue Workflow",
    description: "Intervene on under-enrolled or stagnant classes before launch.",
    workflow: "ENROLLMENT",
    entityType: "CLASS_OFFERING",
    stages: ["under target", "intervention", "recovered or combined"],
    triggers: ["class below 5 near launch", "class below 10 by launch", "enrollment stagnant 5+ days"],
    generatedItemTypes: ["ENROLLMENT_LOW", "ENROLLMENT_TREND_RISK"],
    resolutionConditions: ["enrollment reaches threshold", "classes combined", "plan brought to impact meeting"],
    escalationConditions: ["under-enrolled within 2 weeks of launch"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "live_class_operations",
    name: "Live Class Operations Workflow",
    description: "Run weekly check-ins and observations once classes are live.",
    workflow: "CLASSES",
    entityType: "CLASS_OFFERING",
    stages: ["running", "weekly check-in", "observation"],
    triggers: ["classes running with no weekly check-in", "no observation logged"],
    generatedItemTypes: ["INSTRUCTOR_WEEKLY_CHECKIN_DUE", "CLASS_OBSERVATION_DUE"],
    resolutionConditions: ["check-in logged", "observation logged"],
    escalationConditions: ["instructor underperformance observation unresolved"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "attendance_risk",
    name: "Attendance Risk Workflow",
    description: "Catch absence streaks and attendance decline early.",
    workflow: "ATTENDANCE",
    entityType: "CLASS_OFFERING",
    stages: ["monitoring", "risk detected", "outreach", "recovered"],
    triggers: ["student misses 2+ in a row", "class attendance drops week over week"],
    generatedItemTypes: ["STUDENT_ABSENCE_STREAK", "ATTENDANCE_DROP"],
    resolutionConditions: ["attendance recovers", "family contacted", "issue brought to impact meeting"],
    escalationConditions: ["attendance decline persists"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president / instructor",
  },
  {
    id: "impact_meeting_prep",
    name: "Impact Meeting Prep Workflow",
    description: "Assemble the week's required numbers and one honest answer.",
    workflow: "IMPACT_MEETINGS",
    entityType: "MEETING",
    stages: ["prep due", "numbers gathered", "presented"],
    triggers: ["weekly impact meeting", "week numbers below target"],
    generatedItemTypes: ["IMPACT_MEETING_PREP_DUE", "IMPACT_MEETING_NUMBERS_MISSING"],
    resolutionConditions: ["impact entry submitted / numbers presented"],
    escalationConditions: ["numbers missing at meeting time"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "session_2_recruiting",
    name: "Session 2 Recruiting Workflow",
    description: "Recruit returning students and confirm returning instructors.",
    workflow: "SESSION_REVIEW",
    entityType: "CHAPTER",
    stages: ["recruiting", "returning instructors", "session 2 plan"],
    triggers: ["live classes in Weeks 9–10", "returning-instructor responses due in Weeks 11–12"],
    generatedItemTypes: ["SESSION_2_RECRUITING_DUE", "SESSION_2_RETURNING_INSTRUCTOR_RESPONSE_DUE"],
    resolutionConditions: ["recruiting started", "returning responses collected"],
    escalationConditions: ["no Session 2 plan by end of session"],
    meetingRelevance: "fyi",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "session_review",
    name: "Session Review Workflow",
    description: "Close the session: positives, negatives, and the next-session plan.",
    workflow: "SESSION_REVIEW",
    entityType: "CHAPTER",
    stages: ["session ending", "review", "next-session plan"],
    triggers: ["Weeks 11–12 with launched classes"],
    generatedItemTypes: ["SESSION_REVIEW_DUE"],
    resolutionConditions: ["session review logged"],
    escalationConditions: ["no review by session end"],
    meetingRelevance: "bring",
    defaultOwnerRule: "chapter president",
  },
  {
    id: "chapter_readiness",
    name: "Chapter Readiness Workflow",
    description: "Keep the chapter on the 12-week playbook and launch-ready.",
    workflow: "CHAPTER_READINESS",
    entityType: "CHAPTER",
    stages: ["on pace", "behind", "launch readiness"],
    triggers: ["overdue playbook steps", "blocking readiness gaps near launch"],
    generatedItemTypes: ["CHAPTER_BEHIND_PLAYBOOK"],
    resolutionConditions: ["overdue steps completed", "readiness gaps closed"],
    escalationConditions: ["materially behind playbook", "launch at risk"],
    meetingRelevance: "decision",
    defaultOwnerRule: "chapter president (global leadership notified)",
  },
];

const BY_ID = new Map(WORKFLOW_RECIPES.map((r) => [r.id, r]));
const BY_TYPE = new Map<AutomationItemType, WorkflowRecipe>();
for (const r of WORKFLOW_RECIPES) {
  for (const t of r.generatedItemTypes) {
    if (!BY_TYPE.has(t)) BY_TYPE.set(t, r);
  }
}

export function recipeById(id: string): WorkflowRecipe | undefined {
  return BY_ID.get(id);
}

/** All recipes in a given lane. */
export function recipesForWorkflow(w: AutomationWorkflow): WorkflowRecipe[] {
  return WORKFLOW_RECIPES.filter((r) => r.workflow === w);
}

/** The recipe that generates a given item type (first match). */
export function recipeForType(type: AutomationItemType): WorkflowRecipe | undefined {
  return BY_TYPE.get(type);
}
