import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  getSimplifiedMentorKanban,
  type SimplifiedKanbanCard,
} from "@/lib/mentorship-kanban-actions";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import {
  EmptySimpleState,
  SimpleListCard,
} from "@/components/command-center/simple";
import { MentorshipFocusCard, MentorshipRow } from "@/components/mentorship/calm";
import { buildMentorHomeViewModel } from "@/lib/mentorship/load";
import { mentorCardNeedsAttention } from "../_components/mentor-priority-list";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";
import { MentorRoster, type RosterMentee } from "./mentor-roster";

export const metadata = { title: "Your Mentees — YPP Mentorship" };

export default async function MenteesPage() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("MENTOR") &&
    !roles.includes("CHAPTER_PRESIDENT") &&
    !roles.includes("ADMIN")
  ) {
    redirect("/");
  }

  const [board, engagement] = await Promise.all([
    getSimplifiedMentorKanban(),
    getMentorEngagementSnapshot(),
  ]);

  const quietIds = new Set(engagement.quietMentees.map((m) => m.menteeId));

  const toRoster = (card: SimplifiedKanbanCard): RosterMentee => ({
    mentorshipId: card.mentorshipId,
    menteeId: card.menteeId,
    menteeName: card.menteeName,
    menteePrimaryRole: card.menteePrimaryRole,
    cycleStage: card.cycleStage,
    mentorTag: card.mentorTag,
    ctaLabel: card.cta.label,
    ctaHref: card.cta.href ?? null,
    ctaDisabled: card.cta.disabled ?? false,
    ctaPrimary: card.cta.variant === "primary",
    isQuiet: quietIds.has(card.menteeId),
    needsAttention: mentorCardNeedsAttention(card),
  });

  const active = board.columns
    .flatMap((c) => c.cards)
    .map(toRoster)
    .sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      return a.menteeName.localeCompare(b.menteeName);
    });
  const inactive = board.inactive
    .map(toRoster)
    .sort((a, b) => a.menteeName.localeCompare(b.menteeName));

  const total = board.total;
  const needsCount = active.filter((m) => m.needsAttention).length;

  // One canonical view-model drives the Calm summary (single focus + the
  // mentees waiting on the mentor); Executive keeps the full searchable roster.
  const vm = buildMentorHomeViewModel({
    viewerId: userId,
    viewerName: "You",
    isAdmin: roles.includes("ADMIN"),
    cards: board.columns.flatMap((c) => c.cards).map((card) => ({
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
  const needsIds = new Set(
    active.filter((m) => m.needsAttention).map((m) => m.menteeId)
  );
  const needsList = vm.relationships
    .filter((r) => needsIds.has(r.menteeId))
    .slice(0, 5);

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Your mentees"
        subtitle={
          total === 0
            ? "Instructors you mentor will appear here once you're paired."
            : `${total} mentee${total === 1 ? "" : "s"} · ${
                needsCount > 0
                  ? `${needsCount} need${needsCount === 1 ? "s" : ""} you now`
                  : "all caught up"
              }. Open anyone for their full workspace.`
        }
        backHref="/mentorship"
        backLabel="Mentorship"
      />

      {total === 0 ? (
        <EmptyStateEditorial
          title="Your roster is waiting."
          body="Every instructor you mentor will land here once chapter leadership pairs you — each with their cycle status, flags, and what they need from you next. The mentorship hub is your home base until then."
          link={{ label: "Open the mentorship hub", href: "/mentorship" }}
        />
      ) : (
        <div className="grid gap-5">
          <CalmOnly>
            <div className="flex flex-col gap-5">
              {vm.focus ? (
                <MentorshipFocusCard focus={vm.focus} />
              ) : (
                <EmptySimpleState icon="check">
                  Everyone&apos;s settled this cycle — browse the full roster below
                  to look anyone up.
                </EmptySimpleState>
              )}
              {needsList.length > 0 ? (
                <SimpleListCard title="Needs you now">
                  {needsList.map((relationship) => (
                    <MentorshipRow key={relationship.id} relationship={relationship} />
                  ))}
                </SimpleListCard>
              ) : null}
            </div>
          </CalmOnly>

          <CalmCollapse
            label="Browse all mentees"
            hint={`${total} total${needsCount > 0 ? ` · ${needsCount} need you` : ""}`}
          >
            <MentorRoster active={active} inactive={inactive} />
          </CalmCollapse>
        </div>
      )}
    </div>
  );
}
