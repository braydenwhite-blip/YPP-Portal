/**
 * Student Operating System / Growth Engine (Phase N1) — track unification.
 *
 * Different tracks, ONE engine. This maps each GrowthTrack onto a shared
 * progression model and, where one exists, the existing role-ladder config in
 * lib/growth-pathway.ts (Instructor + Leadership rubrics) — so the Growth Engine
 * reads the SAME role copy the rest of the app already uses instead of forking a
 * parallel definition. Pure: re-exports config + helpers, no IO.
 */

import { TRACKS, TRACK_ORDER, type TrackId } from "@/lib/growth-pathway";
import {
  GROWTH_TRACKS,
  GROWTH_TRACK_LABELS,
  type GrowthTrackId,
} from "./constants";

export interface GrowthTrackInfo {
  id: GrowthTrackId;
  label: string;
  /** One-line framing of what progressing on this track means. */
  description: string;
  /** The role-ladder track this maps to (if any) in lib/growth-pathway.ts. */
  pathwayTrackId: TrackId | null;
}

export const GROWTH_TRACK_INFO: Record<GrowthTrackId, GrowthTrackInfo> = {
  STUDENT: {
    id: "STUDENT",
    label: GROWTH_TRACK_LABELS.STUDENT,
    description: "Your overall journey — classes, certificates, and exploration.",
    pathwayTrackId: null,
  },
  MENTORSHIP: {
    id: "MENTORSHIP",
    label: GROWTH_TRACK_LABELS.MENTORSHIP,
    description: "Growth through a coaching relationship and your mentor's support.",
    pathwayTrackId: null,
  },
  INSTRUCTOR: {
    id: "INSTRUCTOR",
    label: GROWTH_TRACK_LABELS.INSTRUCTOR,
    description: "From the classroom to organization-wide teaching leadership.",
    pathwayTrackId: "INSTRUCTOR",
  },
  LEADERSHIP: {
    id: "LEADERSHIP",
    label: GROWTH_TRACK_LABELS.LEADERSHIP,
    description: "From owning your area to stewarding the whole organization.",
    pathwayTrackId: "LEADERSHIP",
  },
  CHAPTER: {
    id: "CHAPTER",
    label: GROWTH_TRACK_LABELS.CHAPTER,
    description: "Building and leading a chapter — its people, events, and partnerships.",
    pathwayTrackId: "LEADERSHIP",
  },
  HIRING: {
    id: "HIRING",
    label: GROWTH_TRACK_LABELS.HIRING,
    description: "The path from applicant to approved, contributing team member.",
    pathwayTrackId: "INSTRUCTOR",
  },
  ALUMNI: {
    id: "ALUMNI",
    label: GROWTH_TRACK_LABELS.ALUMNI,
    description: "Giving back as an alum — mentoring, advising, and answering questions.",
    pathwayTrackId: null,
  },
};

export const GROWTH_TRACK_ORDER: readonly GrowthTrackId[] = GROWTH_TRACKS;

export function getGrowthTrackInfo(id: GrowthTrackId): GrowthTrackInfo {
  return GROWTH_TRACK_INFO[id];
}

/**
 * The role-ladder config (rungs + competencies) backing a GrowthTrack, sourced
 * from lib/growth-pathway.ts, or null for tracks without a formal ladder.
 */
export function getPathwayForTrack(id: GrowthTrackId) {
  const pathwayTrackId = GROWTH_TRACK_INFO[id].pathwayTrackId;
  return pathwayTrackId ? TRACKS[pathwayTrackId] : null;
}

export { TRACK_ORDER };
