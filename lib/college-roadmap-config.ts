// College roadmap config — no "use server" (shared between server and client)
import type { CollegeStage } from "@prisma/client";

export const STAGE_ORDER: CollegeStage[] = [
  "EXPLORING",
  "BUILDING_PROFILE",
  "TEST_PREP",
  "COLLEGE_LIST",
  "APPLICATIONS",
  "FINANCIAL_AID",
  "DECISION",
  "TRANSITION",
];

export const STAGE_CONFIG: Record<CollegeStage, { label: string; emoji: string; description: string }> = {
  EXPLORING: { label: "Exploring", emoji: "🔍", description: "Learning about college pathways and possibilities" },
  BUILDING_PROFILE: { label: "Building Profile", emoji: "📋", description: "Developing activities, GPA, and leadership" },
  TEST_PREP: { label: "Test Prep", emoji: "📝", description: "SAT/ACT preparation and testing" },
  COLLEGE_LIST: { label: "College List", emoji: "📍", description: "Researching and shortlisting colleges" },
  APPLICATIONS: { label: "Applications", emoji: "✍️", description: "Writing essays and submitting applications" },
  FINANCIAL_AID: { label: "Financial Aid", emoji: "💰", description: "FAFSA, scholarships, and financial planning" },
  DECISION: { label: "Decision", emoji: "🎓", description: "Comparing offers and making final choice" },
  TRANSITION: { label: "Transition", emoji: "🚀", description: "Preparing for college life" },
};
