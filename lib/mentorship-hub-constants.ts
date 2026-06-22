import type { SupportRole } from "@prisma/client";

/**
 * Pure presentation metadata for mentorship support roles.
 *
 * Kept in its own module — with **no server imports** — so client components
 * (e.g. the admin mentorship matching panel) can render role labels without
 * pulling `lib/mentorship-hub.ts` (and its `next/headers`-bound auth chain) into
 * the browser bundle. `lib/mentorship-hub.ts` re-exports this for server callers.
 */
export const SUPPORT_ROLE_META: Record<
  SupportRole,
  { label: string; description: string; tone: string }
> = {
  PRIMARY_MENTOR: {
    label: "Primary mentor",
    description: "Owns the main mentoring relationship and monthly cadence.",
    tone: "#1d4ed8",
  },
  CHAIR: {
    label: "Committee chair",
    description: "Approves reviews and handles escalation decisions.",
    tone: "#6b21c8",
  },
  SPECIALIST_MENTOR: {
    label: "Specialist mentor",
    description: "Helps with subject-specific coaching and projects.",
    tone: "#0f766e",
  },
  COLLEGE_ADVISOR: {
    label: "College advisor",
    description: "Supports college readiness and long-range planning.",
    tone: "#b45309",
  },
  ALUMNI_ADVISOR: {
    label: "Alumni advisor",
    description: "Brings lived experience and future-facing perspective.",
    tone: "#be185d",
  },
  PEER_SUPPORT: {
    label: "Peer support",
    description: "Adds accountability, check-ins, and encouragement.",
    tone: "#166534",
  },
};
