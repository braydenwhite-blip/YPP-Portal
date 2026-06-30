/**
 * Partner Research Assistant — types (Partner Automation, Phase 1 scaffolding).
 *
 * Phase 2 will automatically find and score schools, libraries, and community
 * centers near a chapter. This file defines the data contract now so the import
 * + manual-add flows can produce/consume the same `PartnerResearchCandidate`
 * shape, and the scoring/conversion/dedupe helpers can be built and tested
 * without any brittle web browsing.
 */

import type { PartnerType } from "@/lib/partners-constants";

export type PartnerResearchCandidate = {
  organizationName: string;
  type?: PartnerType | string | null;
  location?: string | null;
  website?: string | null;
  suggestedContactName?: string | null;
  suggestedContactEmail?: string | null;
  /** 0–100 overall confidence this is a good lead (see scoring.ts). */
  confidence: number;
  sourceUrl?: string | null;
  notes?: string | null;
  suggestedNextAction?: string | null;
};

/**
 * Signals a future research source would surface about a candidate. All
 * optional so partial data still scores. Booleans default false; contact
 * confidence is 0–1; proximity is kilometers (null = unknown).
 */
export type ResearchScoringFactors = {
  likelyHasSpace?: boolean;
  servesElementaryMiddle?: boolean;
  hasEnrichmentPrograms?: boolean;
  contactConfidence?: number;
  proximityKm?: number | null;
  knownCommunityInstitution?: boolean;
  priorYppRelationship?: boolean;
};
