import { z } from "zod";
import { isStoredFileUrl } from "@/lib/applicant-video-upload";

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
  passionId: z
    .string()
    .min(1, "Choose a passion area."),
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
// INSTRUCTOR APPLICATION SCHEMA
// ============================================

export const instructorApplicationSchema = z.object({
  // Personal Information
  legalName: z
    .string()
    .min(2, "Please enter your full legal name (at least 2 characters).")
    .max(200, "Name should be under 200 characters."),
  preferredFirstName: z
    .string()
    .min(1, "Please enter your preferred first name.")
    .max(100, "Preferred name should be under 100 characters."),
  phoneNumber: z.string().max(30, "Phone number should be under 30 characters.").optional(),
  dateOfBirth: z.string().optional(),
  hearAboutYPP: z.string().max(300, "Response should be under 300 characters.").optional(),

  // Location
  city: z.string().min(1, "Please enter your town or city.").max(100, "City should be under 100 characters."),
  stateProvince: z
    .string()
    .min(1, "Please enter your state or province.")
    .max(100, "State/province should be under 100 characters."),
  zipCode: z
    .string()
    .min(3, "Please enter a valid ZIP or postal code.")
    .max(20, "ZIP code should be under 20 characters."),
  country: z.enum(["United States", "Other"], { errorMap: () => ({ message: "Please select a country." }) }),
  countryOther: z.string().max(100).optional(),

  // Academic
  schoolName: z
    .string()
    .min(2, "Please enter your high school name.")
    .max(200, "School name should be under 200 characters."),
  graduationYear: z
    .number({ invalid_type_error: "Please select a graduation year." })
    .int()
    .min(2025, "Please select a valid graduation year.")
    .max(2030, "Please select a valid graduation year."),
  gpa: z.string().max(20, "GPA should be under 20 characters.").optional(),
  classRank: z.string().max(100, "Class rank should be under 100 characters.").optional(),
  subjectsOfInterest: z.string().max(500, "Subjects should be under 500 characters.").optional(),

  // Core essays
  motivation: z
    .string()
    .max(5000, "Motivation should be under 5,000 characters.")
    .optional()
    .or(z.literal("")),
  motivationVideoUrl: z
    .string()
    .min(1, "Please upload your teaching approach video.")
    .refine((value) => isStoredFileUrl(value), {
      message: "Please upload your teaching approach video before submitting.",
    }),
  whyYPP: z
    .string()
    .min(100, "Please share at least 100 characters about why you want to join YPP.")
    .max(5000, "Response should be under 5,000 characters."),
  teachingExperience: z
    .string()
    .min(50, "Please describe your teaching experience in at least 50 characters.")
    .max(5000, "Teaching experience should be under 5,000 characters."),
  extracurriculars: z
    .string()
    .min(30, "Please describe your extracurricular activities in at least 30 characters.")
    .max(3000, "Response should be under 3,000 characters."),
  priorLeadership: z
    .string()
    .min(30, "Please describe your leadership experience in at least 30 characters.")
    .max(3000, "Response should be under 3,000 characters."),
  specialSkills: z.string().max(2000, "Special skills should be under 2,000 characters.").optional(),

  // Referral
  referralEmails: z.string().max(2000, "Referral emails should be under 2,000 characters.").optional(),

  // Availability
  availability: z
    .string()
    .min(10, "Please describe your interview availability.")
    .max(1000, "Availability should be under 1,000 characters."),
  hoursPerWeek: z
    .number({ invalid_type_error: "Please enter how many hours per week you can commit." })
    .int()
    .min(1, "Must commit at least 1 hour per week.")
    .max(40, "Please enter a realistic commitment (max 40 hours)."),
  preferredStartDate: z.string().optional(),

  // Optional demographics
  ethnicity: z.string().max(100).optional(),
});

export type InstructorApplicationInput = z.infer<typeof instructorApplicationSchema>;

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
