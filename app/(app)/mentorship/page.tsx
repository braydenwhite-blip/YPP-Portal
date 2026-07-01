import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import Link from "next/link";
import { ButtonLink, CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorship,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { getMentorshipPendingActionCount } from "@/lib/mentorship-notifications";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import { CalmOnly, ExecutiveOnly } from "@/components/command-center/command-mode";
import { buildMentorHomeViewModel } from "@/lib/mentorship/load";
import { mentorCardNeedsAttention } from "./_components/mentor-priority-list";
import { MentorHomeCalm } from "./_components/mentor-home-calm";
import { MentorHomeExecutive } from "./_components/mentor-home-executive";
import { EmptyStateEditorial } from "./_components/empty-state-editorial";

export default async function MentorshipPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  if (!canAccessMentorship(primaryRole ?? "")) {
    redirect("/");
  }

  const isAdmin = roles.includes("ADMIN");
  const membership = await getInstructorMentorshipMembership(userId);
  const showMentorSection = membership.isMentor || isAdmin;

  if (membership.isMentee && !showMentorSection) {
    redirect("/my-mentor");
  }

  if (!showMentorSection) {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship"
          title="Mentorship"
          actions={
            <>
              <ButtonLink href="/my-mentor" variant="secondary" size="sm">
                My Mentor →
              </ButtonLink>
              <ButtonLink href="/leadership-pathway" variant="secondary" size="sm">
                Pathway →
              </ButtonLink>
            </>
          }
        />
        <EmptyStateEditorial
          title="Your mentor workspace is on the way."
          body="Once you're assigned to mentor an instructor, this becomes the place you'll work from each month. If you're looking for your own mentor, open My Mentor."
          link={{
            label: "Open My Mentor",
            href: "/my-mentor",
          }}
        />
      </div>
    );
  }

  const [mentorBlock, engagement, pendingActionCount, chairLanes] =
    await Promise.all([
      getSimplifiedMentorKanban(),
      getMentorEngagementSnapshot(),
      getMentorshipPendingActionCount(userId),
      getLanesForChair(userId, (session.user.adminSubtypes ?? []) as string[]),
    ]);
  const showChairQueue = isAdmin || chairLanes.length > 0;

  const allMentorCards = mentorBlock.columns.flatMap((c) => c.cards);
  const pendingReview =
    mentorBlock.columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
  const needsKickoff = allMentorCards.filter((c) => c.kickoffPending).length;
  const needsYouCount = allMentorCards.filter(mentorCardNeedsAttention).length;
  const menteeCount = mentorBlock.total;
  const activeMenteeCount = mentorBlock.total - mentorBlock.inactive.length;

  // Render only the more urgent of the two top alerts — stacked alerts is
  // noise; one is signal.
  let urgentAlert: { tone: "blue" | "amber"; title: string; detail: string } | null = null;
  if (needsKickoff > 0) {
    urgentAlert = {
      tone: "amber",
      title: `${needsKickoff} instructor${needsKickoff !== 1 ? "s" : ""} need a kickoff meeting`,
      detail: "Schedule and mark the kickoff to unlock the monthly review cycle.",
    };
  } else if (pendingReview > 0) {
    urgentAlert = {
      tone: "blue",
      title: `${pendingReview} instructor${pendingReview !== 1 ? "s" : ""} ready for your review`,
      detail: "Their reflections have been submitted and are waiting on your feedback.",
    };
  }

  const subtitle = `${menteeCount} instructor mentee${
    menteeCount === 1 ? "" : "s"
  } across all cycles.`;

  // One canonical view-model feeds the Calm summary; Executive keeps the full
  // kanban + engagement density it has always shown.
  const vm = buildMentorHomeViewModel({
    viewerId: userId,
    viewerName: "You",
    isAdmin,
    cards: allMentorCards.map((card) => ({
      mentorshipId: card.mentorshipId,
      menteeId: card.menteeId,
      menteeName: card.menteeName,
      cycleStage: card.cycleStage,
      kickoffPending: card.kickoffPending,
      latestRatings: card.latestRatings,
    })),
    sessions: engagement.upcomingSessions.map((s) => ({
      id: s.id,
      menteeId: s.menteeId,
      title: s.title,
      type: s.type,
      scheduledISO: s.scheduledAt,
    })),
    now: new Date(),
  });

  // Reskinned onto the ui-v2 primitives (PageHeaderV2 + CardV2 + ButtonLink)
  // under the `.portalSkin` scope; the Calm/Executive bodies already compose
  // the SimpleSurface kit (mentor-home-calm / mentor-home-executive).
  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship"
        title="Mentorship"
        subtitle={subtitle}
        actions={
          <>
            {membership.isMentee && (
              <ButtonLink href="/my-mentor" variant="secondary" size="sm">
                My Mentor →
              </ButtonLink>
            )}
          </>
        }
      >
        {pendingActionCount > 0 && (
          <Link
            href="/notifications"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-progress-50 px-3 py-1 text-[12.5px] font-semibold text-progress-700 no-underline transition-[filter] hover:brightness-[0.97]"
          >
            {pendingActionCount} mentorship update{pendingActionCount === 1 ? "" : "s"} unread →
          </Link>
        )}
      </PageHeaderV2>

      {mentorBlock.total === 0 ? (
        <EmptyStateEditorial
          title="Ready when they arrive."
          body="You'll see your mentees here as soon as chapter leadership pairs you with one. In the meantime, the leadership pathway is the same rubric you'll use to support them."
          link={{
            label: "See the leadership pathway",
            href: "/leadership-pathway",
          }}
        />
      ) : (
        <div className="grid gap-6">
          {membership.isMentee && (
            <CardV2
              padding="md"
              className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand-600"
            >
              <div className="min-w-0">
                <strong className="text-[14px] text-ink">
                  You&apos;re also being mentored.
                </strong>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Your own goals, released feedback, resources, and check-ins live
                  in My Mentor.
                </p>
              </div>
              <ButtonLink href="/my-mentor" variant="secondary" size="sm">
                Open My Mentor
              </ButtonLink>
            </CardV2>
          )}

          <CalmOnly>
            <MentorHomeCalm
              vm={vm}
              needsYouCount={needsYouCount}
              showChairQueue={showChairQueue}
            />
          </CalmOnly>
          <ExecutiveOnly>
            <MentorHomeExecutive
              urgentAlert={urgentAlert}
              mentorBlock={mentorBlock}
              engagement={engagement}
              activeMenteeCount={activeMenteeCount}
              needsYouCount={needsYouCount}
              showChairQueue={showChairQueue}
            />
          </ExecutiveOnly>
        </div>
      )}
    </div>
  );
}
