// Class Runtime OS (Phase 5) — pure helpers for the post-session reflection.
// Kept prisma-free so the payload shape and the "does this raise a concern?"
// rule are unit-testable.

import { z } from "zod";

export const SubmitReflectionSchema = z
  .object({
    offeringId: z.string().min(1),
    sessionId: z.string().min(1),
    wentWell: z.string().max(4000).optional(),
    struggled: z.string().max(4000).optional(),
    studentToWatch: z.string().max(2000).optional(),
    followUpStudentId: z.string().trim().min(1).optional(),
    changeNextTime: z.string().max(4000).optional(),
    logisticsIssue: z.string().max(2000).optional(),
    needsCpHelp: z.boolean().optional(),
    confidence: z.number().int().min(1).max(5).optional(),
  })
  .superRefine((value, context) => {
    const usefulText = [
      value.wentWell,
      value.struggled,
      value.studentToWatch,
      value.changeNextTime,
      value.logisticsIssue,
    ].some((item) => Boolean(item?.trim()));
    if (!usefulText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wentWell"],
        message: "Add at least one useful recap note.",
      });
    }
    if (value.followUpStudentId && !value.struggled?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["struggled"],
        message: "Describe the follow-up this student needs.",
      });
    }
  });
export type SubmitReflectionInput = z.infer<typeof SubmitReflectionSchema>;

/**
 * Does this reflection warrant a Chapter President touch? Either the instructor
 * explicitly asked for help, or they flagged a logistics problem.
 */
export function reflectionRaisesConcern(r: { needsCpHelp?: boolean | null; logisticsIssue?: string | null }): boolean {
  return Boolean(r.needsCpHelp) || Boolean(r.logisticsIssue && r.logisticsIssue.trim());
}
