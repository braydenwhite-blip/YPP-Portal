/**
 * Pure tally logic for the weekly mentor digest. Kept side-effect free so the
 * classification rules can be unit tested without a database or cron context.
 */

export type DigestMentorshipInput = {
  mentorId: string;
  cycleStage: string;
  kickoffScheduledAt: Date | null;
  /** A non-cancelled session within the quiet-activity window. */
  hasRecentSession: boolean;
  /** A progress check-in within the quiet-activity window. */
  hasRecentCheckIn: boolean;
};

export type MentorDigestTally = {
  mentorId: string;
  reviewsDue: number;
  kickoffsUnscheduled: number;
  quietMentees: number;
};

export function digestTallyHasWork(tally: MentorDigestTally): boolean {
  return (
    tally.reviewsDue > 0 ||
    tally.kickoffsUnscheduled > 0 ||
    tally.quietMentees > 0
  );
}

/** Group active mentorships by mentor and classify each into digest counts. */
export function tallyMentorDigests(
  rows: DigestMentorshipInput[]
): MentorDigestTally[] {
  const byMentor = new Map<string, MentorDigestTally>();

  for (const row of rows) {
    const tally =
      byMentor.get(row.mentorId) ??
      ({
        mentorId: row.mentorId,
        reviewsDue: 0,
        kickoffsUnscheduled: 0,
        quietMentees: 0,
      } satisfies MentorDigestTally);

    if (
      row.cycleStage === "REFLECTION_SUBMITTED" ||
      row.cycleStage === "CHANGES_REQUESTED"
    ) {
      tally.reviewsDue += 1;
    }
    if (row.cycleStage === "KICKOFF_PENDING" && !row.kickoffScheduledAt) {
      tally.kickoffsUnscheduled += 1;
    }
    const isEngagementStage =
      row.cycleStage !== "COMPLETE" && row.cycleStage !== "PAUSED";
    if (isEngagementStage && !row.hasRecentSession && !row.hasRecentCheckIn) {
      tally.quietMentees += 1;
    }

    byMentor.set(row.mentorId, tally);
  }

  return [...byMentor.values()];
}
