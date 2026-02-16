import { z } from "zod";

// ============================================
// JOB APPLICATION SCHEMA
// ============================================

export const jobApplicationSchema = z.object({
  positionId: z.string().min(1, "Position is required."),
  coverLetter: z
    .string()
    .min(50, "Cover letter should be at least 50 characters. Share why you're interested and what makes you a strong fit.")
    .max(5000, "Cover letter should be under 5,000 characters."),
  resumeUrl: z
    .string()
    .url("Please enter a valid URL (e.g., https://drive.google.com/...)")
    .or(z.literal(""))
    .optional(),
  additionalMaterials: z
    .string()
    .max(3000, "Additional materials should be under 3,000 characters.")
    .optional(),
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

// ============================================
// CHAPTER PROPOSAL SCHEMA
// ============================================

export const chapterProposalSchema = z.object({
  chapterName: z
    .string()
    .min(3, "Chapter name must be at least 3 characters.")
    .max(100, "Chapter name should be under 100 characters."),
  partnerSchool: z.string().max(200, "Partner school name should be under 200 characters.").optional(),
  city: z.string().max(100, "City name should be under 100 characters.").optional(),
  region: z.string().max(100, "Region should be under 100 characters.").optional(),
  chapterVision: z
    .string()
    .min(50, "Chapter vision should be at least 50 characters. Explain what student need this chapter addresses.")
    .max(3000, "Chapter vision should be under 3,000 characters."),
  launchPlan: z
    .string()
    .min(50, "Launch plan should be at least 50 characters. Include milestones and a timeline.")
    .max(3000, "Launch plan should be under 3,000 characters."),
  recruitmentPlan: z
    .string()
    .min(50, "Recruitment plan should be at least 50 characters. Describe how you'll find instructors and students.")
    .max(3000, "Recruitment plan should be under 3,000 characters."),
  leadershipBio: z
    .string()
    .min(50, "Leadership bio should be at least 50 characters. Share your background and readiness to lead.")
    .max(3000, "Leadership bio should be under 3,000 characters."),
  resumeUrl: z
    .string()
    .url("Please enter a valid URL.")
    .or(z.literal(""))
    .optional(),
  additionalContext: z
    .string()
    .max(3000, "Additional context should be under 3,000 characters.")
    .optional(),
});

export type ChapterProposalInput = z.infer<typeof chapterProposalSchema>;

// ============================================
// INCUBATOR APPLICATION SCHEMA
// ============================================

export const incubatorApplicationSchema = z.object({
  cohortId: z.string().min(1, "Cohort is required."),
  projectTitle: z
    .string()
    .min(3, "Project title must be at least 3 characters.")
    .max(150, "Project title should be under 150 characters."),
  passionArea: z
    .string()
    .min(2, "Passion area is required.")
    .max(100, "Passion area should be under 100 characters."),
  projectIdea: z
    .string()
    .min(30, "Project idea should be at least 30 characters. Describe what you want to create.")
    .max(3000, "Project idea should be under 3,000 characters."),
  whyThisProject: z
    .string()
    .min(20, "Please share at least 20 characters about why this project matters to you.")
    .max(2000, "This field should be under 2,000 characters."),
  priorExperience: z
    .string()
    .max(2000, "Prior experience should be under 2,000 characters.")
    .optional(),
  goals: z
    .string()
    .min(20, "Goals should be at least 20 characters. What do you hope to learn or accomplish?")
    .max(2000, "Goals should be under 2,000 characters."),
  needsMentor: z.enum(["true", "false"]),
  mentorPreference: z.string().max(200, "Mentor preference should be under 200 characters.").optional(),
});

export type IncubatorApplicationInput = z.infer<typeof incubatorApplicationSchema>;

// ============================================
// INTERVIEW NOTE SCHEMA
// ============================================

export const interviewNoteSchema = z.object({
  applicationId: z.string().min(1),
  content: z
    .string()
    .min(10, "Interview note summary should be at least 10 characters.")
    .max(5000, "Interview note should be under 5,000 characters."),
  recommendation: z.enum(["STRONG_YES", "YES", "MAYBE", "NO", ""]).optional(),
  rating: z.enum(["1", "2", "3", "4", "5", ""]).optional(),
  strengths: z.string().max(3000, "Strengths should be under 3,000 characters.").optional(),
  concerns: z.string().max(3000, "Concerns should be under 3,000 characters.").optional(),
  nextStepSuggestion: z.string().max(2000, "Next step suggestion should be under 2,000 characters.").optional(),
});

export type InterviewNoteInput = z.infer<typeof interviewNoteSchema>;

// ============================================
// HELPERS
// ============================================

export function getFieldError(
  errors: z.ZodError | null,
  field: string
): string | undefined {
  if (!errors) return undefined;
  const issue = errors.issues.find((i) => i.path[0] === field);
  return issue?.message;
}

export function characterCount(value: string, max: number): { count: number; max: number; overLimit: boolean } {
  return { count: value.length, max, overLimit: value.length > max };
}
