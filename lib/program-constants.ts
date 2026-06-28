/**
 * Centralized configuration for all program types.
 *
 * To add a new program type, simply add one entry here — all pages
 * (browse, detail, my-programs, admin, stats) automatically pick it up.
 */

import { ProgramType } from "@prisma/client";

export const PROGRAM_TYPE_CONFIG: Record<ProgramType, {
  label: string;
  description: string;
  color: string;
  lightBg: string;
  textOnColor: string;
  icon: string;
}> = {
  PASSION_LAB: {
    label: "Passion Labs",
    description: "Deep-dive exploration into specific interests and topics",
    color: "#6b21c8",
    lightBg: "#f3ecff",
    textOnColor: "#ffffff",
    icon: "🔬",
  },
  COMPETITION_PREP: {
    label: "Competition Prep",
    description: "Preparation courses for academic and skill competitions",
    color: "#dc2626",
    lightBg: "#fef2f2",
    textOnColor: "#ffffff",
    icon: "🏆",
  },
  EXPERIENCE: {
    label: "Experiences",
    description: "Special events, workshops, and one-of-a-kind activities",
    color: "#16a34a",
    lightBg: "#f0fdf4",
    textOnColor: "#ffffff",
    icon: "✨",
  },
  SEQUENCE: {
    label: "Sequences",
    description: "Multi-course pathways for comprehensive, progressive learning",
    color: "#2563eb",
    lightBg: "#eff6ff",
    textOnColor: "#ffffff",
    icon: "📖",
  },
  SUMMER_WORKSHOP: {
    label: "Summer Workshops",
    description: "In-person, camp-based workshops for elementary and middle school students",
    color: "#ea580c",
    lightBg: "#fff7ed",
    textOnColor: "#ffffff",
    icon: "☀️",
  },
};

/** Stable display order — featured / seasonal types first. */
export const PROGRAM_TYPE_ORDER: ProgramType[] = [
  "SUMMER_WORKSHOP",
  "PASSION_LAB",
  "COMPETITION_PREP",
  "EXPERIENCE",
  "SEQUENCE",
];

export function getProgramConfig(type: ProgramType | string) {
  return PROGRAM_TYPE_CONFIG[type as ProgramType] ?? PROGRAM_TYPE_CONFIG.EXPERIENCE;
}

export function getProgramColor(type: ProgramType | string): string {
  return getProgramConfig(type).color;
}

export function getProgramLightBg(type: ProgramType | string): string {
  return getProgramConfig(type).lightBg;
}

export function formatProgramType(type: ProgramType | string): string {
  return getProgramConfig(type).label;
}
