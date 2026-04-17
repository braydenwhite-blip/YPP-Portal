import Link from "next/link";

import type { getInstructorGrowthDashboardData } from "@/lib/instructor-growth-service";
import {
  reviewInstructorGrowthClaimAction,
  revokeInstructorGrowthEventAction,
} from "@/lib/instructor-growth-actions";
import { InstructorGrowthClaimForm } from "@/components/instructor-growth/claim-form";
import { InstructorGrowthTierPreview } from "@/components/instructor-growth/tier-preview";
import styles from "@/components/instructor-growth/instructor-growth.module.css";

type DashboardData = NonNullable<
  Awaited<ReturnType<typeof getInstructorGrowthDashboardData>>
>;

type InstructorGrowthDashboardProps = {
  data: DashboardData;
  viewerCanReview?: boolean;
  viewerIsSelf?: boolean;
  returnTo: string;
};

const CATEGORY_COLORS: Record<
  string,
  { dot: string; text: string; chipBg: string }
> = {
  TEACHING: { dot: "#198467", text: "#0f4d41", chipBg: "#e6f5ef" },
  GROWTH: { dot: "#347fce", text: "#0d477f", chipBg: "#eaf2fb" },
  COMMUNITY: { dot: "#7469ce", text: "#3a347f", chipBg: "#f0edfd" },
  IMPACT: { dot: "#9c6c2e", text: "#6b5331", chipBg: "#f8f1e8" },
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

function formatRole(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function InstructorGrowthDashboard({
  data,
  viewerCanReview = false,
  viewerIsSelf = false,
  returnTo,
}: InstructorGrowthDashboardProps) {
  const ruleGroups = Object.entries(
    data.rules.reduce<Record<string, typeof data.rules>>((groups, rule) => {
      groups[rule.category] = groups[rule.category] ?? [];
      groups[rule.category].push(rule);
      return groups;
    }, {})
  );

  const reversibleEvents = data.recentEvents.filter(
    (event) => event.status === "APPROVED" && event.sourceMethod !== "AUTO"
  );

  return (
    <div className={styles.shell}>
      <div className={styles.heroGrid}>
        <div className={`${styles.surfaceCard} ${styles.heroCard}`}>
          <p className={styles.eyebrow}>Instructor Growth Record</p>
          <div className={styles.heroTitleRow}>
            <div>
              <h2 className={styles.heroTitle}>{data.currentTier.name}</h2>
              <p className={styles.heroSubtext}>
                {data.currentTier.title}. Lifetime progress stays with the instructor,
                while semester progress shows how this season is unfolding right now.
              </p>
            </div>
            <span
              className={styles.tierBadge}
              style={{
                background: data.currentTier.badgeBackground,
                color: data.currentTier.dotColor,
              }}
            >
              <span
                className={styles.tierBadgeIcon}
                style={{
                  background: data.currentTier.dotBackground,
                  color: data.currentTier.dotColor,
                }}
              >
                {data.currentTier.icon}
              </span>
              {data.currentTier.shortName}
            </span>
          </div>

          <div className={styles.progressWrap}>
            <div className={styles.progressHeader}>
              <span>
                {data.nextTier
                  ? `Progress to ${data.nextTier.name}`
                  : "Top tier reached"}
              </span>
              <strong>{data.progressPercent}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${data.progressPercent}%`,
                  background: data.currentTier.accentColor,
                }}
              />
            </div>
            <p className={styles.progressFoot}>
              {data.nextTier
                ? `${data.pointsToNextTier.toLocaleString()} XP to ${data.nextTier.name}`
                : "You are at the highest tier in the current system."}
            </p>
          </div>

          <div className={styles.heroMetaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaValue}>{data.profile.lifetimeXp.toLocaleString()}</p>
              <p className={styles.metaLabel}>Lifetime XP</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaValue}>{data.profile.currentSemesterXp.toLocaleString()}</p>
              <p className={styles.metaLabel}>{data.currentSemesterLabel}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaValue}>{data.profile.badgeCount}</p>
              <p className={styles.metaLabel}>Badges unlocked</p>
            </div>
          </div>
        </div>

        <div className={styles.stack}>
          <div className={`${styles.surfaceCard} ${styles.mentorCard}`}>
            <p className={styles.eyebrow}>Assigned Mentor</p>
            {data.mentor ? (
              <>
                <h3 className={styles.mentorName}>{data.mentor.name ?? "Assigned mentor"}</h3>
                <p className={styles.mentorMeta}>
                  {data.mentor.email}
                  <br />
                  This mentor is the default coach, claim reviewer, and first visibility partner for this growth record.
                </p>
              </>
            ) : (
              <div className={styles.alert}>
                No active mentor link was found on this instructor record yet. Claims can still be reviewed by chapter leaders or admins, but this mentorship assignment should be repaired.
              </div>
            )}
          </div>

          <div className={styles.summaryGrid}>
            <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
              <p className={styles.summaryValue}>{data.profile.approvedEventCount}</p>
              <p className={styles.summaryLabel}>Approved events</p>
            </div>
            <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
              <p className={styles.summaryValue}>{data.profile.pendingEventCount}</p>
              <p className={styles.summaryLabel}>Pending claims</p>
            </div>
            <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
              <p className={styles.summaryValue}>{data.semesterStats.length}</p>
              <p className={styles.summaryLabel}>Semesters tracked</p>
            </div>
            <div className={`${styles.surfaceCard} ${styles.summaryCard}`}>
              <p className={styles.summaryValue}>{data.visibleBadges.filter((badge) => badge.unlocked).length}</p>
              <p className={styles.summaryLabel}>Unlocked badges</p>
            </div>
          </div>

          {viewerCanReview && data.suspiciousFlags.length > 0 ? (
            <div className={styles.notice}>
              <strong>Reviewer visibility:</strong> this record has{" "}
              {data.suspiciousFlags.length} claim-pattern flag
              {data.suspiciousFlags.length === 1 ? "" : "s"} worth a closer look.
            </div>
          ) : null}
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Tier Ladder</p>
            <h3 className={styles.sectionTitle}>Recognition path</h3>
            <p className={styles.sectionIntro}>
              The frame stays serious and mission-driven. The satisfaction comes from seeing a clean path forward and knowing what each tier actually means.
            </p>
          </div>
        </div>
        <InstructorGrowthTierPreview
          tiers={data.tierRail}
          currentTierKey={data.currentTier.key}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>XP Structure</p>
            <h3 className={styles.sectionTitle}>How progress is earned</h3>
            <p className={styles.sectionIntro}>
              Teaching drives the system, growth and community reward contribution, and impact stays meaningful without overwhelming the rest.
            </p>
          </div>
        </div>

        <div className={styles.dualGrid}>
          <div className={styles.rulesGrid}>
            {ruleGroups.map(([category, rules]) => {
              const color = CATEGORY_COLORS[category];
              return (
                <div key={category} className={`${styles.surfaceCard} ${styles.ruleCard}`}>
                  <div className={styles.ruleHeader}>
                    <span
                      className={styles.ruleCategory}
                      style={{ color: color.text }}
                    >
                      <span
                        className={styles.ruleDot}
                        style={{ background: color.dot }}
                      />
                      {formatRole(category)}
                    </span>
                  </div>
                  <div className={styles.ruleList}>
                    {rules.map((rule) => (
                      <div key={rule.eventKey} className={styles.ruleRow}>
                        <div>
                          <p className={styles.ruleTitle}>{rule.title}</p>
                          <p className={styles.ruleDescription}>
                            {rule.description} {rule.trackingLabel}
                          </p>
                        </div>
                        <span
                          className={styles.xpChip}
                          style={{
                            background: color.chipBg,
                            color: color.text,
                          }}
                        >
                          +{rule.xpAmount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.breakdownStack}>
            <div className={`${styles.surfaceCard} ${styles.breakdownCard}`}>
              <p className={styles.eyebrow}>Lifetime Breakdown</p>
              {Object.values(data.lifetimeBreakdown).map((entry) => (
                <div key={entry.label} className={styles.breakdownRow}>
                  <span>{entry.label}</span>
                  <strong>{entry.value.toLocaleString()} XP</strong>
                </div>
              ))}
            </div>

            <div className={`${styles.surfaceCard} ${styles.breakdownCard}`}>
              <p className={styles.eyebrow}>{data.currentSemesterLabel}</p>
              {Object.values(data.semesterBreakdown).map((entry) => (
                <div key={entry.label} className={styles.breakdownRow}>
                  <span>{entry.label}</span>
                  <strong>{entry.value.toLocaleString()} XP</strong>
                </div>
              ))}
            </div>

            <div className={`${styles.surfaceCard} ${styles.breakdownCard}`}>
              <p className={styles.eyebrow}>Semester Snapshots</p>
              {data.semesterStats.length === 0 ? (
                <div className={styles.emptyState}>
                  Semester cards will appear here as soon as approved activity lands in the ledger.
                </div>
              ) : (
                data.semesterStats.map((stat) => (
                  <div key={stat.id} className={styles.breakdownRow}>
                    <span>{stat.semesterLabel}</span>
                    <strong>{stat.totalXp.toLocaleString()} XP</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Activity Ledger</p>
            <h3 className={styles.sectionTitle}>Recent movement</h3>
            <p className={styles.sectionIntro}>
              Approved, pending, rejected, and revoked entries all live in one clean ledger so the system stays credible.
            </p>
          </div>
        </div>

        <div className={styles.dualGrid}>
          <div className={styles.activityList}>
            {data.recentEvents.length === 0 ? (
              <div className={`${styles.surfaceCard} ${styles.emptyState}`}>
                No activity has landed yet. As soon as training, teaching, feedback, or reviewed claims appear, the ledger will start filling in.
              </div>
            ) : (
              data.recentEvents.map((event) => (
                <div key={event.id} className={`${styles.surfaceCard} ${styles.activityCard}`}>
                  <div className={styles.activityTop}>
                    <div>
                      <p className={styles.activityTitle}>{event.title}</p>
                      <p className={styles.activityMeta}>
                        {event.categoryLabel} · {formatDate(event.occurredAt)} ·{" "}
                        {event.xpAmount > 0 ? `+${event.xpAmount} XP` : "Badge review"}
                      </p>
                    </div>
                    <span
                      className={styles.pill}
                      style={{
                        color: event.statusPill.color,
                        background: event.statusPill.background,
                      }}
                    >
                      {event.statusPill.label}
                    </span>
                  </div>
                  {event.claimContext ? (
                    <p className={styles.activityMeta} style={{ marginTop: 10 }}>
                      {event.claimContext}
                    </p>
                  ) : (
                    <p className={styles.activityMeta} style={{ marginTop: 10 }}>
                      {event.description}
                    </p>
                  )}
                  <p className={styles.activityMeta}>
                    {event.relatedUser ? `Linked with ${event.relatedUser.name}. ` : ""}
                    {event.reviewer ? `Reviewed by ${event.reviewer.name}. ` : ""}
                    {event.evidenceUrl ? (
                      <Link href={event.evidenceUrl} className={styles.inlineLink}>
                        Open evidence
                      </Link>
                    ) : null}
                    {!event.evidenceUrl && event.sourceHref ? (
                      <Link href={event.sourceHref} className={styles.inlineLink}>
                        Open source
                      </Link>
                    ) : null}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className={styles.activityList}>
            <div className={`${styles.surfaceCard} ${styles.activityCard}`}>
              <p className={styles.eyebrow}>Pending Now</p>
              {data.pendingClaims.length === 0 ? (
                <div className={styles.emptyState}>
                  Nothing is waiting in review right now.
                </div>
              ) : (
                data.pendingClaims.map((claim) => (
                  <div key={claim.id} className={styles.breakdownRow}>
                    <div>
                      <strong>{claim.title}</strong>
                      <p className={styles.activityMeta}>
                        {formatDate(claim.occurredAt)}
                        {claim.assignedMentor
                          ? ` · Routed to ${claim.assignedMentor.name}`
                          : " · Routed to leadership coverage"}
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
                ))
              )}
            </div>

            {viewerCanReview && data.suspiciousFlags.length > 0 ? (
              <div className={`${styles.surfaceCard} ${styles.activityCard}`}>
                <p className={styles.eyebrow}>Needs Attention</p>
                <div className={styles.flagList}>
                  {data.suspiciousFlags.map((flag) => (
                    <span
                      key={`${flag.title}-${flag.detail}`}
                      className={`${styles.flag} ${
                        flag.severity === "warning" ? styles.flagWarning : ""
                      }`}
                      title={flag.detail}
                    >
                      {flag.title}
                    </span>
                  ))}
                </div>
                <p className={styles.activityMeta} style={{ marginTop: 10 }}>
                  These are reviewer-only signals meant to slow the decision down when the claim pattern looks unusual.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Badge Collection</p>
            <h3 className={styles.sectionTitle}>Fun unlocks, serious meaning</h3>
            <p className={styles.sectionIntro}>
              Every badge is visible from the start. The page stays mature, but the badge moments get to have a little more personality.
            </p>
          </div>
        </div>

        <div className={styles.badgeGrid}>
          {data.visibleBadges.map((badge) => (
            <div
              key={badge.id}
              className={`${styles.surfaceCard} ${styles.badgeCard} ${
                badge.unlocked ? "" : styles.badgeLocked
              }`}
            >
              {badge.unlocked ? (
                <span
                  className={styles.badgeUnlockedGlow}
                  style={{ background: badge.accentColor }}
                />
              ) : null}
              <div
                className={styles.badgeIcon}
                style={{
                  background: badge.unlocked ? `${badge.accentColor}18` : "#ece8e1",
                  color: badge.unlocked ? badge.accentColor : "#8a8277",
                }}
              >
                {badge.icon}
              </div>
              <p className={styles.badgeName}>{badge.name}</p>
              <p className={styles.badgeDesc}>{badge.description}</p>
              <p className={styles.badgeFlavor}>{badge.flavorText}</p>
              <p className={styles.badgeDesc}>
                {badge.unlocked
                  ? `Unlocked ${formatDate(badge.award?.awardedAt)}`
                  : badge.perkText}
              </p>
            </div>
          ))}
        </div>
      </section>

      {viewerIsSelf ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Claim Flow</p>
              <h3 className={styles.sectionTitle}>Manual review lane</h3>
              <p className={styles.sectionIntro}>
                Auto-tracked work should appear on its own. Use this only for contribution that needs context, verification, or a human decision.
              </p>
            </div>
          </div>
          <InstructorGrowthClaimForm
            instructorId={data.instructor.id}
            returnTo={returnTo}
            mentorName={data.mentor?.name ?? null}
            templates={data.claimTemplates}
            relatedUserOptions={data.relatedUserOptions}
          />
        </section>
      ) : null}

      {viewerCanReview ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Reviewer Tools</p>
              <h3 className={styles.sectionTitle}>Decision lane for this instructor</h3>
              <p className={styles.sectionIntro}>
                Approvals move XP into the totals immediately. Rejections block it. Revocations stay available for reviewed claims if something later proves false or invalid.
              </p>
            </div>
          </div>

          <div className={styles.reviewGrid}>
            <div className={styles.activityList}>
              {data.pendingClaims.length === 0 ? (
                <div className={`${styles.surfaceCard} ${styles.emptyState}`}>
                  No pending claims are waiting on this instructor right now.
                </div>
              ) : (
                data.pendingClaims.map((claim) => (
                  <div key={claim.id} className={`${styles.surfaceCard} ${styles.activityCard}`}>
                    <div className={styles.activityTop}>
                      <div>
                        <p className={styles.activityTitle}>{claim.title}</p>
                        <p className={styles.activityMeta}>
                          {claim.categoryLabel} · {formatDateTime(claim.createdAt)} ·{" "}
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
                      Submitted by {claim.submittedBy?.name ?? "Unknown"}.
                      {claim.relatedUser ? ` Linked with ${claim.relatedUser.name}.` : ""}
                      {claim.evidenceUrl ? " Evidence attached below." : ""}
                    </p>
                    {claim.evidenceUrl ? (
                      <p className={styles.activityMeta}>
                        <Link href={claim.evidenceUrl} className={styles.inlineLink}>
                          Open evidence
                        </Link>
                      </p>
                    ) : null}

                    <form
                      action={reviewInstructorGrowthClaimAction}
                      className={styles.reviewForm}
                    >
                      <input type="hidden" name="eventId" value={claim.id} />
                      <input
                        type="hidden"
                        name="instructorId"
                        value={data.instructor.id}
                      />
                      <input type="hidden" name="returnTo" value={returnTo} />
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
                          Approve claim
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="REJECTED"
                          className={styles.secondaryButton}
                        >
                          Reject claim
                        </button>
                      </div>
                    </form>
                  </div>
                ))
              )}
            </div>

            <div className={styles.activityList}>
              <div className={`${styles.surfaceCard} ${styles.activityCard}`}>
                <p className={styles.eyebrow}>Reversible Reviewed Events</p>
                {reversibleEvents.length === 0 ? (
                  <div className={styles.emptyState}>
                    There are no recently approved manual or claim-based events available for reversal here.
                  </div>
                ) : (
                  reversibleEvents.map((event) => (
                    <form
                      key={event.id}
                      action={revokeInstructorGrowthEventAction}
                      className={styles.reviewForm}
                    >
                      <input type="hidden" name="eventId" value={event.id} />
                      <input
                        type="hidden"
                        name="instructorId"
                        value={data.instructor.id}
                      />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <div className={styles.breakdownRow}>
                        <div>
                          <strong>{event.title}</strong>
                          <p className={styles.activityMeta}>
                            Approved entry · {formatDate(event.occurredAt)}
                          </p>
                        </div>
                        <strong>+{event.xpAmount}</strong>
                      </div>
                      <textarea
                        className={`${styles.textarea} ${styles.reviewTextarea}`}
                        name="reason"
                        placeholder="Reason for revoking this reviewed event."
                        required
                      />
                      <button type="submit" className={styles.secondaryButton}>
                        Revoke event
                      </button>
                    </form>
                  ))
                )}
              </div>

              <div className={styles.mutedBlock}>
                Keep reversals rare and specific. This lane exists so false claims or later-invalidated reviewed events can be corrected without corrupting the instructor’s lifetime record.
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
