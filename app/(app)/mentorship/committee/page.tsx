import Link from "next/link";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";
import { getSession } from "@/lib/auth-supabase";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { loadQuarterlyCommitteeQueue } from "@/lib/mentorship/quarterly-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Role Committee queue — Mentorship" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_CHAIR_APPROVAL: "Pending committee approval",
  CHANGES_REQUESTED: "Changes requested",
  PENDING_BOARD_APPROVAL: "Pending Board approval",
};

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PENDING_CHAIR_APPROVAL: "warning",
  CHANGES_REQUESTED: "danger",
  PENDING_BOARD_APPROVAL: "brand",
};

export default async function RoleCommitteeQueuePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isLeadership = await hasMentorshipCommandAccess(session.user);
  const chairedLanes = isAdmin || isLeadership ? [] : await getLanesForChair(session.user.id, session.user.adminSubtypes ?? []);
  const isMentorRole = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isLeadership && chairedLanes.length === 0 && !isMentorRole) {
    redirect("/mentorship");
  }

  const allDue = await loadQuarterlyCommitteeQueue();

  // Scope: admins/leadership see everything; a lane chair sees their lane's
  // mentees (their roleType, which spans both Officer and Global Director/
  // Manager lanes since review routing stays 3-bucketed); a mentor sees
  // their own mentees regardless of chair status — they're the one who
  // starts and drafts the packet.
  const visible = isAdmin || isLeadership
    ? allDue
    : allDue.filter((entry) => {
        const roleType = toMenteeRoleType(entry.menteeRole);
        const chairsThisLane = roleType != null && chairedLanes.includes(roleType);
        const isTheirMentee = entry.mentorId === session.user.id;
        return chairsThisLane || isTheirMentee;
      });

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Role Committee"
        title="Quarterly committee queue"
        subtitle="Everyone due for a quarterly committee review — start, discuss, or approve from here; the actual packet lives on each person's page."
        backHref="/mentorship"
        backLabel="Mentorship"
      />

      {visible.length === 0 ? (
        <EmptyStateEditorial
          title="Nothing due right now."
          body="Quarterly committee reviews appear here once a mentee's 3rd/6th/9th... monthly cycle has been released. Nothing needs manual routing."
          link={{ label: "Back to Mentorship", href: "/mentorship" }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((entry) => (
            <Link
              key={entry.mentorshipId}
              href={`/people/${entry.menteeId}?section=review`}
              className="group no-underline"
            >
              <CardV2
                as="article"
                padding="md"
                className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand-600 transition-shadow group-hover:shadow-overlay"
              >
                <div className="min-w-[260px] flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-ink">{entry.menteeName}</span>
                    {entry.menteeRole && <StatusBadge tone="neutral">{entry.menteeRole.replace(/_/g, " ")}</StatusBadge>}
                  </div>
                  <p className="m-0 text-[13px] text-ink-muted">
                    Mentor: {entry.mentorName ?? "Unassigned"} &middot; {entry.quarter}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <StatusBadge tone={entry.status ? STATUS_TONE[entry.status] : "warning"}>
                    {entry.status ? STATUS_LABEL[entry.status] : "Not started"}
                  </StatusBadge>
                  <span aria-hidden className="text-[18px] text-ink-muted transition-colors group-hover:text-brand-700">
                    &rsaquo;
                  </span>
                </div>
              </CardV2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
