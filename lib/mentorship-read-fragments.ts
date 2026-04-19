/**
 * Mentorship columns safe to read on databases that may lag migrations
 * (avoids Prisma selecting newer columns such as `kickoffNotes` when the root
 * query uses `include`, which pulls every scalar on the model).
 */
export const MENTORSHIP_LEGACY_ROOT_SELECT = {
  id: true,
  mentorId: true,
  menteeId: true,
  type: true,
  programGroup: true,
  governanceMode: true,
  status: true,
  startDate: true,
  endDate: true,
  notes: true,
  trackId: true,
  chairId: true,
  kickoffScheduledAt: true,
  kickoffCompletedAt: true,
} as const;

export const MENTORSHIP_CHECK_IN_SELECT = {
  id: true,
  mentorshipId: true,
  notes: true,
  rating: true,
  createdAt: true,
} as const;
