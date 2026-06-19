import { redirect } from "next/navigation";
import Link from "next/link";
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
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship</p>
            <h1 className="page-title">Mentorship</h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/my-mentor" className="button secondary small">
              My Mentor →
            </Link>
            <Link href="/leadership-pathway" className="button secondary small">
              Pathway →
            </Link>
          </div>
        </div>
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

  // TODO(reskin): mentorship home still uses the legacy `.topbar` layout
  // rather than the calm SimpleSurface primitives, so it inherits the new
  // tokens but not the YPP Portal mockup's card/lane composition. Rebuild on
  // SimpleSurface + the reskinned ui-v2 primitives and apply the `.portalSkin`
  // scope (mockup view: "Mentorship" — lanes for needs-review / needs-check-in
  // / missing G&Rs / active pairs / follow-ups).
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Mentorship</h1>
          <p className="page-subtitle">{subtitle}</p>
          {pendingActionCount > 0 && (
            <Link
              href="/notifications"
              className="pill"
              style={{
                marginTop: 8,
                display: "inline-block",
                background: "#fef3c7",
                color: "#92400e",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {pendingActionCount} mentorship update{pendingActionCount === 1 ? "" : "s"} unread →
            </Link>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {membership.isMentee && (
            <Link href="/my-mentor" className="button secondary small">
              My Mentor →
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin/mentorship" className="button secondary small">
              Admin Oversight →
            </Link>
          )}
        </div>
      </div>

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
        <div style={{ display: "grid", gap: 24 }}>
          {membership.isMentee && (
            <div
              className="card"
              style={{
                borderLeft: "4px solid var(--color-primary)",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>You&apos;re also being mentored.</strong>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Your own goals, released feedback, resources, and check-ins live
                  in My Mentor.
                </p>
              </div>
              <Link href="/my-mentor" className="button secondary small">
                Open My Mentor
              </Link>
            </div>
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
