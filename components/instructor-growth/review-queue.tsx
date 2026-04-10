import Link from "next/link";

import type { getInstructorGrowthReviewQueueData } from "@/lib/instructor-growth-service";
import { reviewInstructorGrowthClaimAction } from "@/lib/instructor-growth-actions";
import styles from "@/components/instructor-growth/instructor-growth.module.css";

type ReviewQueueData = Awaited<ReturnType<typeof getInstructorGrowthReviewQueueData>>;

type ReviewQueueProps = {
  data: ReviewQueueData;
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

export function InstructorGrowthReviewQueue({
  data,
}: ReviewQueueProps) {
  const needsAttention = data.pendingClaims.filter((claim) =>
    claim.flags.some((flag) => flag.severity === "warning")
  );
  const mentorRouted = data.pendingClaims.filter(
    (claim) =>
      Boolean(claim.assignedMentorId) &&
      !claim.flags.some((flag) => flag.severity === "warning")
  );
  const missingMentor = data.pendingClaims.filter(
    (claim) =>
      !claim.assignedMentorId &&
      !claim.flags.some((flag) => flag.severity === "warning")
  );

  const lanes = [
    {
      key: "mentor",
      title: "Mentor Routed",
      intro: "Claims already carrying a mentor destination.",
      claims: mentorRouted,
    },
    {
      key: "missing",
      title: "Coverage Needed",
      intro: "Claims missing a mentor route and likely needing chapter/admin attention.",
      claims: missingMentor,
    },
    {
      key: "attention",
      title: "Needs Attention",
      intro: "Claims carrying at least one warning signal.",
      claims: needsAttention,
    },
  ];

  return (
    <div className={styles.shell}>
      <div className={styles.summaryGrid}>
        <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
          <p className={styles.summaryValue}>{data.summary.pendingCount}</p>
          <p className={styles.summaryLabel}>Pending claims</p>
        </div>
        <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
          <p className={styles.summaryValue}>{data.summary.instructorCount}</p>
          <p className={styles.summaryLabel}>Instructors affected</p>
        </div>
        <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
          <p className={styles.summaryValue}>{data.summary.mentorRoutedCount}</p>
          <p className={styles.summaryLabel}>Mentor-routed items</p>
        </div>
        <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
          <p className={styles.summaryValue}>{data.summary.missingMentorCount}</p>
          <p className={styles.summaryLabel}>Missing mentor route</p>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Review Board</p>
            <h3 className={styles.sectionTitle}>Kanban-style review lanes</h3>
            <p className={styles.sectionIntro}>
              The board keeps the operational work visible without turning the instructor experience into a leaderboard or public game. Each card is still private, reviewer-facing work.
            </p>
          </div>
        </div>

        <div className={styles.kanbanBoard}>
          {lanes.map((lane) => (
            <section key={lane.key} className={`${styles.surfaceCard} ${styles.kanbanLane}`}>
              <div className={styles.kanbanLaneHeader}>
                <div>
                  <p className={styles.eyebrow}>{lane.title}</p>
                  <p className={styles.kanbanLaneIntro}>{lane.intro}</p>
                </div>
                <span className={styles.kanbanCount}>{lane.claims.length}</span>
              </div>

              <div className={styles.kanbanStack}>
                {lane.claims.length === 0 ? (
                  <div className={styles.emptyState}>Nothing in this lane right now.</div>
                ) : (
                  lane.claims.map((claim) => (
                    <div key={`${lane.key}-${claim.id}`} className={`${styles.surfaceCard} ${styles.kanbanCard}`}>
                      <div className={styles.activityTop}>
                        <div>
                          <p className={styles.activityTitle}>{claim.title}</p>
                          <p className={styles.activityMeta}>
                            {claim.instructor.name ?? "Instructor"} ·{" "}
                            {claim.instructor.chapter?.name ?? "No chapter"} ·{" "}
                            {claim.xpAmount > 0 ? `+${claim.xpAmount} XP` : "Badge review"}
                          </p>
                        </div>
                        <span
                          className={styles.pill}
                          style={{
                            color: claim.statusPill.color,
                            background: claim.statusPill.background,
                          }}
                        >
                          {claim.statusPill.label}
                        </span>
                      </div>

                      <p className={styles.activityMeta} style={{ marginTop: 10 }}>
                        {claim.claimContext}
                      </p>
                      <p className={styles.activityMeta}>
                        Submitted {formatDateTime(claim.createdAt)}.
                        {claim.assignedMentor
                          ? ` Routed to ${claim.assignedMentor.name}.`
                          : " Routed to leadership coverage."}
                        {claim.relatedUser ? ` Linked with ${claim.relatedUser.name}.` : ""}
                      </p>

                      {claim.flags.length > 0 ? (
                        <div className={styles.flagList}>
                          {claim.flags.map((flag) => (
                            <span
                              key={`${claim.id}-${flag.title}-${flag.detail}`}
                              className={`${styles.flag} ${
                                flag.severity === "warning" ? styles.flagWarning : ""
                              }`}
                              title={flag.detail}
                            >
                              {flag.title}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {claim.evidenceUrl ? (
                        <p className={styles.activityMeta}>
                          <Link href={claim.evidenceUrl} className={styles.inlineLink}>
                            Open evidence
                          </Link>
                        </p>
                      ) : null}

                      <p className={styles.activityMeta}>
                        <Link
                          href={`/instructor-growth/${claim.instructorId}`}
                          className={styles.inlineLink}
                        >
                          Open full instructor record
                        </Link>
                      </p>

                      <form
                        action={reviewInstructorGrowthClaimAction}
                        className={styles.reviewForm}
                      >
                        <input type="hidden" name="eventId" value={claim.id} />
                        <input type="hidden" name="instructorId" value={claim.instructorId} />
                        <input type="hidden" name="returnTo" value="/instructor-growth/review" />
                        <textarea
                          className={`${styles.textarea} ${styles.reviewTextarea}`}
                          name="reviewNotes"
                          placeholder="Optional approval note, or required rejection reason."
                        />
                        <div className={styles.reviewButtonRow}>
                          <button
                            type="submit"
                            name="decision"
                            value="APPROVED"
                            className={styles.primaryButton}
                          >
                            Approve
                          </button>
                          <button
                            type="submit"
                            name="decision"
                            value="REJECTED"
                            className={styles.secondaryButton}
                          >
                            Reject
                          </button>
                        </div>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Recent Decisions</p>
            <h3 className={styles.sectionTitle}>Latest reviewed claims</h3>
          </div>
        </div>

        <div className={styles.activityList}>
          {data.recentReviewed.length === 0 ? (
            <div className={`${styles.surfaceCard} ${styles.emptyState}`}>
              Reviewed items will appear here after the first decision lands.
            </div>
          ) : (
            data.recentReviewed.map((claim) => (
              <div key={claim.id} className={`${styles.surfaceCard} ${styles.activityCard}`}>
                <div className={styles.activityTop}>
                  <div>
                    <p className={styles.activityTitle}>{claim.title}</p>
                    <p className={styles.activityMeta}>
                      {claim.instructor.name ?? "Instructor"} · Reviewed{" "}
                      {formatDateTime(claim.reviewedAt)}
                    </p>
                  </div>
                  <span
                    className={styles.pill}
                    style={{
                      color: claim.statusPill.color,
                      background: claim.statusPill.background,
                    }}
                  >
                    {claim.statusPill.label}
                  </span>
                </div>
                <p className={styles.activityMeta}>
                  Reviewer: {claim.reviewer?.name ?? "Unknown"}
                  {claim.reviewNotes ? ` · ${claim.reviewNotes}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
