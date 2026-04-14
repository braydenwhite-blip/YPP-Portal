import { GoalRatingColor, MenteeRoleType } from "@prisma/client";

// Achievement point values per overall rating x role type.
// This stays in a plain module so both server actions and server components can
// import it without tripping Next.js "use server" export rules.
export const POINT_TABLE: Record<GoalRatingColor, Record<MenteeRoleType, number>> = {
  BEHIND_SCHEDULE: { INSTRUCTOR: 0, CHAPTER_PRESIDENT: 0, GLOBAL_LEADERSHIP: 0 },
  GETTING_STARTED: { INSTRUCTOR: 10, CHAPTER_PRESIDENT: 20, GLOBAL_LEADERSHIP: 25 },
  ACHIEVED: { INSTRUCTOR: 35, CHAPTER_PRESIDENT: 50, GLOBAL_LEADERSHIP: 60 },
  ABOVE_AND_BEYOND: { INSTRUCTOR: 75, CHAPTER_PRESIDENT: 85, GLOBAL_LEADERSHIP: 100 },
};
