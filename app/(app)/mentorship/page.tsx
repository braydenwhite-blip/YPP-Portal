import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorship,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { getMentorshipPendingActionCount } from "@/lib/mentorship-notifications";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import {
  MentorPriorityList,
  mentorCardNeedsAttention,
} from "./_components/mentor-priority-list";
import {
  MentorCommandStrip,
  MentorEngagementPanels,
} from "./_components/mentor-command-center";
import { MenteeDashboard } from "./_components/mentee-dashboard";
import { MentorshipTabShell } from "./_components/mentorship-tab-shell";
import { EmptyStateEditorial } from "./_components/empty-state-editorial";

interface PageProps {
  searchParams?: Promise<{ view?: string }>;
}

export default async function MentorshipPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  if (!canAccessMentorship(primaryRole ?? "")) {
    redirect("/my-program?notice=mentorship-not-available");
  }

  const params = (await searchParams) ?? {};

  const isAdmin = roles.includes("ADMIN");
  const membership = await getInstructorMentorshipMembership(userId);
  const showMentorSection = membership.isMentor || isAdmin;
  const showMenteeSection = membership.isMentee;

  // Neither: editorial empty state instead of a generic card.
  if (!showMenteeSection && !showMentorSection) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship</p>
            <h1 className="page-title">Your mentorship</h1>
          </div>
          <Link href="/leadership-pathway" className="button secondary small">
            Pathway →
          </Link>
        </div>
        <EmptyStateEditorial
          title="Your home base is on the way."
          body="Once you're paired with a mentor — or assigned to mentor an instructor — this page becomes the place you'll work from each month. Reach out to chapter leadership if you expected to be paired."
          link={{
            label: "See the leadership pathway",
            href: "/leadership-pathway",
          }}
        />
      </div>
    );
  }

  const [mentorBlockResult, engagementResult, pendingActionCount] =
    await Promise.all([
      showMentorSection ? getSimplifiedMentorKanban() : Promise.resolve(null),
      showMentorSection ? getMentorEngagementSnapshot() : Promise.resolve(null),
      getMentorshipPendingActionCount(userId),
    ]);
  const mentorBlock = mentorBlockResult;
  const engagement = engagementResult;

  const allMentorCards = mentorBlock?.columns.flatMap((c) => c.cards) ?? [];
  const pendingReview =
    mentorBlock?.columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
  const needsKickoff = allMentorCards.filter((c) => c.kickoffPending).length;
  const needsYouCount = allMentorCards.filter(mentorCardNeedsAttention).length;
  const menteeCount = mentorBlock?.total ?? 0;
  const activeMenteeCount = mentorBlock
    ? mentorBlock.total - mentorBlock.inactive.length
    : 0;

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

  const subtitle =
    showMenteeSection && showMentorSection
      ? "Your mentorship — the people who develop you, and the instructors you develop."
      : showMenteeSection
        ? "Your goals, reflections, feedback, and progress with your mentor."
        : `${menteeCount} instructor mentee${menteeCount === 1 ? "" : "s"} across all cycles.`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Your mentorship</h1>
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
          {isAdmin && (
            <Link href="/admin/mentorship" className="button secondary small">
              Admin Oversight →
            </Link>
          )}
        </div>
      </div>

      <MentorshipTabShell
        requestedView={params.view}
        showMentee={showMenteeSection}
        showMentor={showMentorSection}
        menteeCount={menteeCount}
        menteeContent={<MenteeDashboard userId={userId} />}
        mentorContent={
          <MentorTabContent
            urgentAlert={urgentAlert}
            mentorBlock={mentorBlock}
            engagement={engagement}
            activeMenteeCount={activeMenteeCount}
            needsYouCount={needsYouCount}
          />
        }
      />
    </div>
  );
}

function MentorTabContent({
  urgentAlert,
  mentorBlock,
  engagement,
  activeMenteeCount,
  needsYouCount,
}: {
  urgentAlert: { tone: "blue" | "amber"; title: string; detail: string } | null;
  mentorBlock: Awaited<ReturnType<typeof getSimplifiedMentorKanban>> | null;
  engagement: Awaited<ReturnType<typeof getMentorEngagementSnapshot>> | null;
  activeMenteeCount: number;
  needsYouCount: number;
}) {
  if (!mentorBlock || mentorBlock.total === 0) {
    return (
      <EmptyStateEditorial
        title="Ready when they arrive."
        body="You'll see your mentees here as soon as chapter leadership pairs you with one. In the meantime, the leadership pathway is the same rubric you'll use to support them."
        link={{
          label: "See the leadership pathway",
          href: "/leadership-pathway",
        }}
      />
    );
  }

  const alertColors =
    urgentAlert?.tone === "amber"
      ? { border: "#f59e0b", bg: "#fffbeb", text: "#92400e" }
      : { border: "#3b82f6", bg: "#eff6ff", text: "#1e40af" };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <MentorCommandStrip
        activeMentees={activeMenteeCount}
        needsYou={needsYouCount}
        upcomingSessionCount={engagement?.upcomingSessionCount ?? 0}
        nextSessionAt={engagement?.nextSessionAt ?? null}
        quietCount={engagement?.quietMentees.length ?? 0}
      />

      {urgentAlert && (
        <div
          style={{
            padding: "14px 18px",
            background: alertColors.bg,
            borderLeft: `4px solid ${alertColors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
          role="status"
        >
          <div>
            <strong style={{ color: alertColors.text }}>{urgentAlert.title}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: alertColors.text, opacity: 0.85 }}>
              {urgentAlert.detail}
            </p>
          </div>
        </div>
      )}

      <MentorPriorityList
        columns={mentorBlock.columns}
        inactive={mentorBlock.inactive}
        total={mentorBlock.total}
      />

      {engagement && (
        <MentorEngagementPanels
          upcomingSessions={engagement.upcomingSessions}
          quietMentees={engagement.quietMentees}
        />
      )}
    </div>
  );
}
