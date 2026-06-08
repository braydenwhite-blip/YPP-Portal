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
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  MentorPriorityList,
  mentorCardNeedsAttention,
} from "./_components/mentor-priority-list";
import {
  MentorCommandStrip,
  MentorEngagementPanels,
} from "./_components/mentor-command-center";
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
            <h1 className="page-title">Mentor Workspace</h1>
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

  const [mentorBlockResult, engagementResult, pendingActionCount, chairLanes] =
    await Promise.all([
      getSimplifiedMentorKanban(),
      getMentorEngagementSnapshot(),
      getMentorshipPendingActionCount(userId),
      getLanesForChair(userId, (session.user.adminSubtypes ?? []) as string[]),
    ]);
  const mentorBlock = mentorBlockResult;
  const engagement = engagementResult;
  const showChairQueue = isAdmin || chairLanes.length > 0;

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

  const subtitle = `${menteeCount} instructor mentee${
    menteeCount === 1 ? "" : "s"
  } across all cycles.`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Mentor Workspace</h1>
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
          {isMentorship2Enabled() && (
            <Link href="/mentorship/dashboard" className="button secondary small">
              Dashboard →
            </Link>
          )}
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

      <MentorTabContent
        urgentAlert={urgentAlert}
        mentorBlock={mentorBlock}
        engagement={engagement}
        activeMenteeCount={activeMenteeCount}
        needsYouCount={needsYouCount}
        showChairQueue={showChairQueue}
        isDualRole={membership.isMentee}
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
  showChairQueue,
  isDualRole,
}: {
  urgentAlert: { tone: "blue" | "amber"; title: string; detail: string } | null;
  mentorBlock: Awaited<ReturnType<typeof getSimplifiedMentorKanban>> | null;
  engagement: Awaited<ReturnType<typeof getMentorEngagementSnapshot>> | null;
  activeMenteeCount: number;
  needsYouCount: number;
  showChairQueue: boolean;
  isDualRole: boolean;
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
      {isDualRole && (
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

      <MentorCommandStrip
        activeMentees={activeMenteeCount}
        needsYou={needsYouCount}
        upcomingSessionCount={engagement?.upcomingSessionCount ?? 0}
        nextSessionAt={engagement?.nextSessionAt ?? null}
        quietCount={engagement?.quietMentees.length ?? 0}
      />

      <MentorWorkspaceLinks showChairQueue={showChairQueue} />

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

function MentorWorkspaceLinks({ showChairQueue }: { showChairQueue: boolean }) {
  const links = [
    { href: "/mentorship/mentees", label: "My Mentees" },
    { href: "/mentorship/reviews", label: "Monthly Reviews" },
    { href: "/mentorship/schedule", label: "Schedule" },
    { href: "/mentorship/resources", label: "Resources" },
    { href: "/mentorship/ask", label: "Ask / Flag" },
    { href: "/mentorship/feedback", label: "Feedback" },
    { href: "/mentorship/awards", label: "Awards" },
    { href: "/mentor/incubator", label: "Project Mentoring" },
    ...(showChairQueue ? [{ href: "/mentorship/chair", label: "Chair Queue" }] : []),
  ];

  return (
    <nav
      aria-label="Mentor workspace sections"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            padding: "10px 12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            textDecoration: "none",
            fontWeight: 650,
            fontSize: 13,
          }}
        >
          {link.label} →
        </Link>
      ))}
    </nav>
  );
}
