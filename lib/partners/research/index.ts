/**
 * Partner Research Assistant — public surface (Partner Automation scaffolding).
 * Phase 2 will add automated discovery sources that emit `PartnerResearchCandidate`s;
 * everything downstream (scoring, conversion, dedupe) is already built here.
 */
export type { PartnerResearchCandidate, ResearchScoringFactors } from "@/lib/partners/research/types";
export { scoreResearchCandidate, confidenceLabel } from "@/lib/partners/research/scoring";
export {
  candidateToPartnerInput,
  candidateIdentity,
  findCandidateDuplicates,
  type PartnerCreateInput,
} from "@/lib/partners/research/convert";
