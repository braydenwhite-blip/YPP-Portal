// The canonical launch checklist every launching chapter works through. Items
// are seeded as LaunchTask rows (scope = "CHAPTER") when a chapter enters the
// launching stage. Items flagged `spawnsAction` also create a real ActionItem in
// the Action Tracker, owned by the Chapter President, so the chapter's next steps
// live in one accountability system instead of a separate checklist silo.
//
// Pure module (data + helpers only) so it is unit testable.

export type LaunchChecklistKey =
  | "confirm_cp"
  | "confirm_school_advisor"
  | "add_founding_team"
  | "choose_first_program"
  | "schedule_kickoff"
  | "recruit_first_members"
  | "submit_launch_plan"
  | "approve_launch_plan"
  | "run_first_meeting"
  | "upload_notes_attendance"
  | "mark_active";

export type LaunchChecklistOwner = "cp" | "leadership";

export type LaunchChecklistItemDef = {
  key: LaunchChecklistKey;
  title: string;
  description: string;
  // Who is responsible for completing it.
  owner: LaunchChecklistOwner;
  // When true, seeding this item also creates a real ActionItem owned by the CP.
  spawnsAction: boolean;
  // Suggested due date offset (days from when launching begins).
  dueInDays: number;
  order: number;
};

export const LAUNCH_CHECKLIST: LaunchChecklistItemDef[] = [
  {
    key: "confirm_cp",
    title: "Confirm Chapter President",
    description: "The approved Chapter President is set as the chapter's leader.",
    owner: "leadership",
    spawnsAction: false,
    dueInDays: 0,
    order: 1,
  },
  {
    key: "confirm_school_advisor",
    title: "Confirm school & faculty advisor",
    description: "Lock in the partner school and a faculty advisor who will sponsor the chapter.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 7,
    order: 2,
  },
  {
    key: "add_founding_team",
    title: "Add founding team",
    description: "Identify 2–4 founding officers/volunteers to help run the chapter.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 10,
    order: 3,
  },
  {
    key: "choose_first_program",
    title: "Choose first program",
    description: "Pick the first class, workshop, or event the chapter will run.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 14,
    order: 4,
  },
  {
    key: "schedule_kickoff",
    title: "Schedule kickoff meeting",
    description: "Put the first chapter meeting on the calendar.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 14,
    order: 5,
  },
  {
    key: "recruit_first_members",
    title: "Recruit first members",
    description: "Sign up the chapter's first cohort of students toward the recruitment goal.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 21,
    order: 6,
  },
  {
    key: "submit_launch_plan",
    title: "Submit launch plan",
    description: "Write up the launch plan (timeline, programs, recruitment) for leadership review.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 21,
    order: 7,
  },
  {
    key: "approve_launch_plan",
    title: "Leadership approves launch plan",
    description: "National leadership reviews and approves the launch plan.",
    owner: "leadership",
    spawnsAction: false,
    dueInDays: 24,
    order: 8,
  },
  {
    key: "run_first_meeting",
    title: "Run first meeting",
    description: "Hold the kickoff meeting with the founding team and first members.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 28,
    order: 9,
  },
  {
    key: "upload_notes_attendance",
    title: "Upload notes & attendance",
    description: "Record the first meeting's notes and attendance in the portal.",
    owner: "cp",
    spawnsAction: true,
    dueInDays: 30,
    order: 10,
  },
  {
    key: "mark_active",
    title: "Mark chapter active",
    description: "Once the first meeting is done and members are recruited, the chapter goes active.",
    owner: "leadership",
    spawnsAction: false,
    dueInDays: 30,
    order: 11,
  },
];

export const LAUNCH_CHECKLIST_BY_KEY: Record<LaunchChecklistKey, LaunchChecklistItemDef> =
  Object.fromEntries(LAUNCH_CHECKLIST.map((item) => [item.key, item])) as Record<
    LaunchChecklistKey,
    LaunchChecklistItemDef
  >;

export function isLaunchChecklistKey(value: string): value is LaunchChecklistKey {
  return value in LAUNCH_CHECKLIST_BY_KEY;
}

export type LaunchChecklistProgress = {
  total: number;
  done: number;
  // 0–100
  percent: number;
  // The lowest-order item that is not yet done — the chapter's "next step".
  nextItem: LaunchChecklistItemDef | null;
};

/**
 * Summarize launch progress from a map of completed checklist keys. Used by the
 * CP workspace ("what's next") and leadership command (progress bars).
 */
export function summarizeLaunchProgress(
  doneKeys: Iterable<string>
): LaunchChecklistProgress {
  const done = new Set(doneKeys);
  const total = LAUNCH_CHECKLIST.length;
  const completed = LAUNCH_CHECKLIST.filter((item) => done.has(item.key)).length;
  const nextItem =
    LAUNCH_CHECKLIST.slice()
      .sort((a, b) => a.order - b.order)
      .find((item) => !done.has(item.key)) ?? null;
  return {
    total,
    done: completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    nextItem,
  };
}
