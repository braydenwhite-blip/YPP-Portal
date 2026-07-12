import { z } from "zod";

const OptionalUrl = z
  .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value && value.length > 0 ? value : null;
  });

export const SaveSessionPreparationSchema = z.object({
  offeringId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
  lessonPlanId: z
    .union([z.string().trim().min(1), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value && value.length > 0 ? value : null;
    }),
  notesUrl: OptionalUrl,
  materialsUrl: OptionalUrl,
  preparationNote: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  markComplete: z.boolean().default(false),
});

export type SaveSessionPreparationInput = z.infer<typeof SaveSessionPreparationSchema>;

