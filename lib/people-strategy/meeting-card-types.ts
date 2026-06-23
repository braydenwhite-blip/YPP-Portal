/**
 * People Strategy — light meeting view-model types.
 *
 * These re-export the canonical view-model types from `meetings-queries.ts` (the
 * adapter over the new Meeting model) so every surface shares one definition.
 * Type-only re-exports keep this module free of the adapter's server-only
 * runtime, so it stays importable from anywhere.
 */
export type {
  EffectiveFollowUpStatus,
  EffectiveMeetingStatus,
} from "./meetings-status";
export type {
  DecisionDTO,
  FollowUpDTO,
  LinkedActionDTO,
  MeetingCardDTO,
  PersonDTO,
} from "./meetings-queries";
