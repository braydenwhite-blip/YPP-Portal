/**
 * Zod schemas for review-cycle mutations (importable from client + server —
 * the "use server" actions module may only export async functions).
 */
import { z } from "zod";

import { CYCLE_KINDS } from "./cycle-constants";
import { ROLE_GROUPS } from "./cohort";

const LANE_IDS = [
  "concern",
  "overloaded",
  "review-due",
  "needs-coach",
  "no-recent-checkin",
  "ready-for-more",
  "recently-supported",
] as const;

export const CohortScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role-group"), group: z.enum(ROLE_GROUPS) }),
  z.object({ type: z.literal("chapter"), chapterId: z.string().trim().min(1) }),
  z.object({
    type: z.literal("lane"),
    lane: z.enum(LANE_IDS),
    population: z.enum(["instructor", "officer"]),
  }),
  z.object({
    type: z.literal("custom"),
    userIds: z.array(z.string().trim().min(1)).min(1).max(500),
    label: z.string().trim().min(1).max(200).optional(),
  }),
]);

export const LaunchReviewCycleSchema = z.object({
  kind: z.enum(CYCLE_KINDS),
  name: z.string().trim().min(1).max(200).optional(),
  dueDate: z.coerce.date().nullish(),
  scope: CohortScopeSchema,
});

export type LaunchReviewCycleInput = z.infer<typeof LaunchReviewCycleSchema>;
