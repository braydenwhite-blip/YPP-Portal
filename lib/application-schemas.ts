import { z } from "zod";

// Job Position Application Schema
export const jobApplicationSchema = z.object({
  coverLetter: z
    .string()
    .min(1, "Cover letter is required")
    .min(50, "Cover letter should be at least 50 characters. Please provide more detail about your experience and interest.")
    .max(5000, "Cover letter is too long. Please keep it under 5000 characters.")
    .optional()
    .or(z.literal("")),
  resumeUrl: z
    .string()
    .url("Please enter a valid URL (e.g., https://drive.google.com/...)")
    .optional()
    .or(z.literal("")),
  additionalMaterials: z
    .string()
    .max(2000, "Additional materials description is too long. Please keep it under 2000 characters.")
    .optional()
    .or(z.literal("")),
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

// Chapter Proposal Schema
export const chapterProposalSchema = z.object({
  chapterName: z
    .string()
    .min(1, "Chapter name is required")
    .min(3, "Chapter name should be at least 3 characters")
    .max(100, "Chapter name is too long. Please keep it under 100 characters."),
  partnerSchool: z
    .string()
    .max(200, "Partner school name is too long. Please keep it under 200 characters.")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .max(100, "City name is too long. Please keep it under 100 characters.")
    .optional()
    .or(z.literal("")),
  region: z
    .string()
    .max(100, "Region/state is too long. Please keep it under 100 characters.")
    .optional()
    .or(z.literal("")),
  chapterVision: z
    .string()
    .min(1, "Chapter vision is required")
    .min(100, "Please provide more detail about why this chapter should exist. Aim for 200-400 words.")
    .max(3000, "Chapter vision is too long. Please keep it under 3000 characters."),
  launchPlan: z
    .string()
    .min(1, "90-day launch plan is required")
    .min(100, "Please provide more detail about your launch plan. Include first cohort details, class pilots, milestones, and timeline.")
    .max(3000, "Launch plan is too long. Please keep it under 3000 characters."),
  recruitmentPlan: z
    .string()
    .min(1, "Recruitment and operations plan is required")
    .min(100, "Please provide more detail about your recruitment strategy. How will you find instructors and students?")
    .max(3000, "Recruitment plan is too long. Please keep it under 3000 characters."),
  leadershipBio: z
    .string()
    .min(1, "Leadership bio is required")
    .min(100, "Please provide more detail about why you should be chapter president. Include your leadership background and local relationships.")
    .max(3000, "Leadership bio is too long. Please keep it under 3000 characters."),
  resumeUrl: z
    .string()
    .url("Please enter a valid URL (e.g., https://drive.google.com/...)")
    .optional()
    .or(z.literal("")),
  additionalContext: z
    .string()
    .max(2000, "Additional context is too long. Please keep it under 2000 characters.")
    .optional()
    .or(z.literal("")),
});

export type ChapterProposalInput = z.infer<typeof chapterProposalSchema>;

// Incubator Application Schema
export const incubatorApplicationSchema = z.object({
  projectTitle: z
    .string()
    .min(1, "Project title is required")
    .min(3, "Project title should be at least 3 characters")
    .max(200, "Project title is too long. Please keep it under 200 characters."),
  passionArea: z
    .string()
    .min(1, "Passion area is required")
    .max(100, "Passion area is too long. Please keep it under 100 characters."),
  projectIdea: z
    .string()
    .min(1, "Project idea is required")
    .min(50, "Please provide more detail about your project idea. What will you create?")
    .max(2000, "Project idea is too long. Please keep it under 2000 characters."),
  whyItMatters: z
    .string()
    .min(1, "Why this project matters is required")
    .min(50, "Please provide more detail about why this project matters to you.")
    .max(2000, "Why it matters is too long. Please keep it under 2000 characters."),
  priorExperience: z
    .string()
    .max(2000, "Prior experience is too long. Please keep it under 2000 characters.")
    .optional()
    .or(z.literal("")),
  goals: z
    .string()
    .min(1, "Goals are required")
    .min(30, "Please provide more detail about what you hope to achieve.")
    .max(2000, "Goals are too long. Please keep them under 2000 characters."),
  wantsMentor: z
    .enum(["yes", "no"], {
      errorMap: () => ({ message: "Please select whether you would like a mentor" }),
    })
    .optional(),
  mentorPreference: z
    .string()
    .max(500, "Mentor preference is too long. Please keep it under 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type IncubatorApplicationInput = z.infer<typeof incubatorApplicationSchema>;

// Helper function to get user-friendly validation errors
export function getValidationErrors(
  error: z.ZodError
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  }

  return errors;
}

// Helper function to validate form data
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: getValidationErrors(result.error),
  };
}
