import type {
  LeadershipActionCategory,
  LeadershipActionPriority,
  LeadershipActionSource,
  LeadershipActionStatus,
  LeadershipMeetingKind,
} from "@prisma/client";

export const CATEGORY_VALUES: LeadershipActionCategory[] = [
  "INSTRUCTION",
  "TECHNOLOGY",
  "COMMUNICATION",
  "STAFF_MANAGEMENT",
];

export const STATUS_VALUES: LeadershipActionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
];

export const PRIORITY_VALUES: LeadershipActionPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export const SOURCE_VALUES: LeadershipActionSource[] = [
  "MANUAL",
  "SPREADSHEET",
  "EMAIL",
  "IMPORT",
];

export const MEETING_KIND_VALUES: LeadershipMeetingKind[] = [
  "OFFICERS",
  "MARKETING",
  "TECH",
  "INSTRUCTION",
  "STAFF",
  "OTHER",
];

export interface CategoryStyle {
  label: string;
  /** Single-letter color code matching the email convention (Pink, Blue, Green, Purple). */
  colorName: "Pink" | "Blue" | "Green" | "Purple";
  bg: string;
  fg: string;
  border: string;
  accent: string;
}

export const CATEGORY_STYLES: Record<LeadershipActionCategory, CategoryStyle> = {
  INSTRUCTION: {
    label: "Core Instruction",
    colorName: "Pink",
    bg: "#fdf2f8",
    fg: "#9d174d",
    border: "#fbcfe8",
    accent: "#ec4899",
  },
  TECHNOLOGY: {
    label: "Technology",
    colorName: "Blue",
    bg: "#eff6ff",
    fg: "#1e3a8a",
    border: "#bfdbfe",
    accent: "#3b82f6",
  },
  COMMUNICATION: {
    label: "Communication",
    colorName: "Green",
    bg: "#ecfdf5",
    fg: "#065f46",
    border: "#a7f3d0",
    accent: "#10b981",
  },
  STAFF_MANAGEMENT: {
    label: "Staff Management",
    colorName: "Purple",
    bg: "#f5f3ff",
    fg: "#5b21b6",
    border: "#ddd6fe",
    accent: "#8b5cf6",
  },
};

export const STATUS_STYLES: Record<
  LeadershipActionStatus,
  { label: string; bg: string; fg: string }
> = {
  NOT_STARTED: { label: "Not started", bg: "#f1f5f9", fg: "#475569" },
  IN_PROGRESS: { label: "In progress", bg: "#fef3c7", fg: "#92400e" },
  BLOCKED: { label: "Blocked", bg: "#fee2e2", fg: "#991b1b" },
  COMPLETE: { label: "Complete", bg: "#dcfce7", fg: "#166534" },
};

export const PRIORITY_STYLES: Record<
  LeadershipActionPriority,
  { label: string; bg: string; fg: string }
> = {
  LOW: { label: "Low", bg: "#f1f5f9", fg: "#475569" },
  NORMAL: { label: "Normal", bg: "#e0e7ff", fg: "#3730a3" },
  HIGH: { label: "High", bg: "#fef3c7", fg: "#92400e" },
  URGENT: { label: "Urgent", bg: "#fee2e2", fg: "#991b1b" },
};

export const MEETING_KIND_LABELS: Record<LeadershipMeetingKind, string> = {
  OFFICERS: "Officers",
  MARKETING: "Marketing",
  TECH: "Tech Team",
  INSTRUCTION: "Instruction",
  STAFF: "Staff",
  OTHER: "Other",
};

export const SOURCE_LABELS: Record<LeadershipActionSource, string> = {
  MANUAL: "Entered manually",
  SPREADSHEET: "From spreadsheet",
  EMAIL: "From email update",
  IMPORT: "Bulk import",
};
