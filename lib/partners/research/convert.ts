/**
 * Convert a research candidate into the input shape for creating a Partner,
 * and detect likely duplicates before creating (Partner Automation).
 *
 * Pure; the server action layers chapter scoping + persistence on top.
 */

import { asPartnerType } from "@/lib/partners-constants";
import {
  findLikelyDuplicates,
  type PartnerIdentity,
  type DuplicateMatch,
} from "@/lib/partners/duplicate-detection";
import type { PartnerResearchCandidate } from "@/lib/partners/research/types";

/** Field shape consumed by the create-partner action. */
export type PartnerCreateInput = {
  name: string;
  partnerType: string | null;
  location: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  source: string;
  chapterId: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

export function candidateToPartnerInput(
  candidate: PartnerResearchCandidate,
  chapterId: string | null
): PartnerCreateInput {
  const rawType = typeof candidate.type === "string" ? candidate.type : null;
  return {
    name: candidate.organizationName.trim(),
    partnerType: asPartnerType(rawType),
    location: clean(candidate.location),
    website: clean(candidate.website),
    contactName: clean(candidate.suggestedContactName),
    contactEmail: clean(candidate.suggestedContactEmail),
    notes: clean(candidate.notes),
    source: candidate.sourceUrl ? `Research: ${candidate.sourceUrl}` : "Research",
    chapterId,
  };
}

/** Identity view of a candidate for duplicate detection. */
export function candidateIdentity(candidate: PartnerResearchCandidate): PartnerIdentity {
  return {
    name: candidate.organizationName,
    website: candidate.website ?? null,
    contactEmail: candidate.suggestedContactEmail ?? null,
    location: candidate.location ?? null,
  };
}

export function findCandidateDuplicates(
  candidate: PartnerResearchCandidate,
  existing: PartnerIdentity[],
  threshold?: number
): DuplicateMatch[] {
  return findLikelyDuplicates(candidateIdentity(candidate), existing, threshold);
}
