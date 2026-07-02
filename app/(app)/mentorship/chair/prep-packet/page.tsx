import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { generateCommitteePrepPacket } from "@/lib/committee-prep-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  StatusBadge,
  buttonVariants,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import { EmptyStateEditorial } from "../../_components/empty-state-editorial";

export const metadata = { title: "Committee prep packet — Mentorship" };

const TIER_LABELS: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  LIFETIME: "Lifetime",
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

/** GoalRatingColor → StatusBadge tone + card accent. */
const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};
const RATING_ACCENT: Record<string, string> = {
  ABOVE_AND_BEYOND: "border-t-brand-600",
  ACHIEVED: "border-t-success-700",
  GETTING_STARTED: "border-t-warning-700",
  BEHIND_SCHEDULE: "border-t-danger-700",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[13.5px] font-bold text-ink">{children}</h2>;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="m-0 text-[12px] text-ink-muted">{label}</p>
      <p className="m-0 mt-0.5 text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export default async function PrepPacketPage({
  searchParams,
}: {
  searchParams: Promise<{ mentorshipId?: string }>;
}) {
  const { mentorshipId } = await searchParams;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAuthorized = roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT");
  if (!isAuthorized) redirect("/");

  if (!mentorshipId) {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · Review cycle"
          title="Committee prep packet"
          backHref="/mentorship/chair"
          backLabel="Review inbox"
        />
        <EmptyStateEditorial
          title="No mentorship selected."
          body="A prep packet is generated for one mentorship at a time. Head back to the review inbox and open a mentee to generate theirs."
          link={{ label: "Back to the review inbox", href: "/mentorship/chair" }}
        />
      </div>
    );
  }

  let packet;
  try {
    packet = await generateCommitteePrepPacket(mentorshipId);
  } catch {
    redirect("/mentorship/chair");
  }

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Review cycle"
        title={`Prep packet: ${packet.mentee.name}`}
        subtitle={`Generated ${new Date(packet.generatedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`}
        backHref="/mentorship/chair"
        backLabel="Review inbox"
        actions={
          <>
            <ButtonLink href="/mentorship/chair" variant="secondary" size="sm">
              Back
            </ButtonLink>
            <button
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </>
        }
      />

      {/* Mentee profile */}
      <CardV2 as="section" padding="md">
        <div className="mb-4 border-b border-line-soft pb-2">
          <SectionTitle>Mentee profile</SectionTitle>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Fact label="Name" value={packet.mentee.name} />
          <Fact label="Email" value={packet.mentee.email} />
          <Fact label="Role" value={ROLE_LABELS[packet.mentee.role] ?? packet.mentee.role} />
          <Fact label="Chapter" value={packet.mentee.chapter ?? "—"} />
          <Fact label="Mentor" value={packet.mentor.name} />
          <Fact
            label="Tenure"
            value={`${packet.mentee.tenureMonths} month${packet.mentee.tenureMonths !== 1 ? "s" : ""} in program`}
          />
        </div>
      </CardV2>

      {/* Achievement progress */}
      <CardV2 as="section" padding="md">
        <div className="mb-4 border-b border-line-soft pb-2">
          <SectionTitle>Achievement progress</SectionTitle>
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="m-0 text-[12px] text-ink-muted">Total points</p>
            <p className="m-0 mt-0.5 text-[22px] font-bold text-ink">
              {packet.achievement.totalPoints}
            </p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-ink-muted">Current tier</p>
            <p className="m-0 mt-0.5 text-[22px] font-bold text-ink">
              {packet.achievement.currentTier
                ? TIER_LABELS[packet.achievement.currentTier]
                : "None"}
            </p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-ink-muted">Next tier threshold</p>
            <p className="m-0 mt-0.5 text-[22px] font-bold text-ink">
              {packet.achievement.nextTierThreshold} pts
            </p>
          </div>
          <div>
            <p className="m-0 text-[12px] text-ink-muted">Progress</p>
            <p
              className={`m-0 mt-0.5 text-[22px] font-bold ${
                packet.achievement.progressPercent >= 75 ? "text-success-700" : "text-ink"
              }`}
            >
              {packet.achievement.progressPercent}%
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${packet.achievement.progressPercent}%` }}
          />
        </div>
        {packet.achievement.recentPointLogs.length > 0 && (
          <div>
            <p className="m-0 mb-1.5 text-[12px] text-ink-muted">Recent point history:</p>
            {packet.achievement.recentPointLogs.map((log, i) => (
              <div key={i} className="flex justify-between py-0.5 text-[13px] text-ink">
                <span>
                  Cycle {log.cycleNumber}
                  {log.reason ? ` — ${log.reason}` : ""}
                </span>
                <span className="font-bold text-success-700">+{log.points}</span>
              </div>
            ))}
          </div>
        )}
      </CardV2>

      {/* Last 3 reviews side-by-side */}
      {packet.last3Reviews.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Last 3 monthly reviews</SectionTitle>
          <div className="flex gap-4 overflow-x-auto">
            {packet.last3Reviews.map((review) => {
              const ratingCfg = getGoalRatingCopy(review.overallRating);
              return (
                <CardV2
                  key={review.cycleNumber}
                  padding="md"
                  className={`min-w-[220px] flex-1 border-t-4 ${
                    RATING_ACCENT[review.overallRating] ?? "border-t-brand-600"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-bold text-ink">
                      Cycle {review.cycleNumber}
                    </span>
                    <StatusBadge tone={RATING_TONE[review.overallRating] ?? "neutral"}>
                      {ratingCfg.label}
                    </StatusBadge>
                  </div>
                  <p className="m-0 mb-2 text-[12px] text-ink-muted">
                    {new Date(review.cycleMonth).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {review.goalRatings.map((gr) => {
                    const grCfg = getGoalRatingCopy(gr.rating);
                    return (
                      <div
                        key={gr.goalTitle}
                        className="mb-0.5 flex items-center justify-between gap-2 text-[12.5px]"
                      >
                        <span className="min-w-0 flex-1 truncate text-ink">{gr.goalTitle}</span>
                        <StatusBadge tone={RATING_TONE[gr.rating] ?? "neutral"} className="shrink-0">
                          {grCfg.label}
                        </StatusBadge>
                      </div>
                    );
                  })}
                  {review.pointsAwarded !== null && (
                    <p className="m-0 mt-1.5 text-[12.5px] font-bold text-success-700">
                      +{review.pointsAwarded} pts
                    </p>
                  )}
                </CardV2>
              );
            })}
          </div>
        </section>
      )}

      {/* Stakeholder feedback */}
      <CardV2 as="section" padding="md">
        <div className="mb-4 border-b border-line-soft pb-2">
          <SectionTitle>Stakeholder feedback summary</SectionTitle>
        </div>
        {packet.stakeholderFeedback.totalResponses === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">
            No stakeholder feedback collected for this quarter.
          </p>
        ) : (
          <div>
            <div className="mb-4 flex gap-8">
              <div>
                <p className="m-0 text-[12px] text-ink-muted">Responses</p>
                <p className="m-0 mt-0.5 text-[20px] font-bold text-ink">
                  {packet.stakeholderFeedback.totalResponses}
                </p>
              </div>
              <div>
                <p className="m-0 text-[12px] text-ink-muted">Avg rating</p>
                <p className="m-0 mt-0.5 text-[20px] font-bold text-ink">
                  {packet.stakeholderFeedback.avgRating !== null
                    ? `${packet.stakeholderFeedback.avgRating}/5`
                    : "—"}
                </p>
              </div>
            </div>
            {packet.stakeholderFeedback.strengthsHighlights.length > 0 && (
              <div className="mb-3">
                <p className="m-0 mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-success-700">
                  Key strengths
                </p>
                {packet.stakeholderFeedback.strengthsHighlights.map((s, i) => (
                  <p key={i} className="m-0 mb-1 text-[13px] leading-relaxed text-ink">
                    &quot;{s}&quot;
                  </p>
                ))}
              </div>
            )}
            {packet.stakeholderFeedback.growthHighlights.length > 0 && (
              <div>
                <p className="m-0 mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-warning-700">
                  Growth areas
                </p>
                {packet.stakeholderFeedback.growthHighlights.map((s, i) => (
                  <p key={i} className="m-0 mb-1 text-[13px] leading-relaxed text-ink">
                    &quot;{s}&quot;
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardV2>

      {/* Open next steps */}
      {packet.openActionItems.length > 0 && (
        <CardV2 as="section" padding="md">
          <div className="mb-3">
            <SectionTitle>Open next steps ({packet.openActionItems.length})</SectionTitle>
          </div>
          <div className="divide-y divide-line-soft">
            {packet.openActionItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[13px] text-ink">{item.title}</span>
                <StatusBadge tone={item.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                  {item.status.replace(/_/g, " ")}
                </StatusBadge>
              </div>
            ))}
          </div>
        </CardV2>
      )}

      {/* Suggested discussion topics */}
      {packet.suggestedDiscussionTopics.length > 0 && (
        <CardV2 as="section" padding="md">
          <div className="mb-3">
            <SectionTitle>Suggested discussion topics</SectionTitle>
          </div>
          <ol className="m-0 pl-5">
            {packet.suggestedDiscussionTopics.map((topic, i) => (
              <li key={i} className="mb-1.5 text-[13.5px] leading-relaxed text-ink">
                {topic}
              </li>
            ))}
          </ol>
        </CardV2>
      )}
    </div>
  );
}
