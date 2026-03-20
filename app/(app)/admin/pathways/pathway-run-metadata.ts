import { ChapterPathwayRunStatus } from "@prisma/client";

export const CHAPTER_RUN_STATUS_OPTIONS: Array<{
  value: ChapterPathwayRunStatus;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    value: "NOT_OFFERED",
    label: "Not offered",
    description: "Hidden from the chapter-first journey until the chapter chooses to run it.",
    tone: "var(--gray-600, #4b5563)",
  },
  {
    value: "COMING_SOON",
    label: "Coming soon",
    description: "Visible to the chapter as a planned run, but not yet ready for enrollment.",
    tone: "var(--amber-700, #b45309)",
  },
  {
    value: "ACTIVE",
    label: "Active",
    description: "The chapter is actively running this pathway with real instructors and offerings.",
    tone: "var(--green-700, #15803d)",
  },
  {
    value: "PAUSED",
    label: "Paused",
    description: "The chapter has temporarily stopped the run, but the pathway still exists.",
    tone: "var(--red-700, #b91c1c)",
  },
];

export function getChapterRunStatusMeta(status?: ChapterPathwayRunStatus | null) {
  return CHAPTER_RUN_STATUS_OPTIONS.find((option) => option.value === status) ?? CHAPTER_RUN_STATUS_OPTIONS[0];
}

export function formatOwnerLabel(owner?: { name: string; primaryRole?: string | null } | null) {
  if (!owner) return "No owner assigned";
  const role = owner.primaryRole ? owner.primaryRole.replaceAll("_", " ") : "Owner";
  return `${owner.name} · ${role}`;
}

