// College activity config — no "use server" (shared between server and client)
import type { ActivityCategory } from "@prisma/client";

export const ACTIVITY_CATEGORY_CONFIG: Record<ActivityCategory, { label: string; emoji: string; commonAppCategory: string }> = {
  LEADERSHIP: { label: "Leadership", emoji: "🌟", commonAppCategory: "School/Community Leadership" },
  COMMUNITY_SERVICE: { label: "Community Service", emoji: "🤝", commonAppCategory: "Community Service" },
  ATHLETICS: { label: "Athletics", emoji: "⚽", commonAppCategory: "Athletics: General" },
  ARTS_CREATIVE: { label: "Arts & Creative", emoji: "🎨", commonAppCategory: "Art" },
  ACADEMIC: { label: "Academic", emoji: "📚", commonAppCategory: "Academic" },
  WORK_INTERNSHIP: { label: "Work/Internship", emoji: "💼", commonAppCategory: "Work" },
  PERSONAL_PROJECT: { label: "Personal Project", emoji: "💡", commonAppCategory: "Other" },
  STEM: { label: "STEM", emoji: "🔬", commonAppCategory: "Science/Math" },
  OTHER: { label: "Other", emoji: "📌", commonAppCategory: "Other" },
};
