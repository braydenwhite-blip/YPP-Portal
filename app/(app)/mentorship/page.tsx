import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { DevelopmentCockpit } from "@/components/development/development-cockpit";
import {
  HubSwitcher,
  MenteeHomeView,
  MentorConsoleView,
} from "@/components/development/mentorship-hub";
import { getSession } from "@/lib/auth-supabase";
import { HUB_VIEW_META, parseHubView } from "@/lib/development/hub";
import {
  loadHubViews,
  loadMenteeHome,
  loadMentorConsole,
} from "@/lib/development/hub-load";
import { loadDevelopmentOverview } from "@/lib/development/load";
import { LANE_META, type DevelopmentLaneId } from "@/lib/development/signals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentorship — Pathways Portal" };

/**
 * The mentorship hub — ONE front door for leadership development with three
 * perspectives:
 *
 *   My development  — your mentor, what's waiting on you, your coaching plan
 *   Mentor console  — the people you coach, one next step each
 *   Oversight       — the leadership command center (lanes + review queue)
 *
 * Everything deeper (the monthly review inbox, mentee G&R detail, review
 * cycle workspaces, development records, program admin) is a supporting
 * detail route linked from here.
 */

const INTERNAL_ROLES = new Set([
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
  "MENTOR",
  "INSTRUCTOR",
]);

function parseLane(value: string | undefined): DevelopmentLaneId | null {
  if (value && value in LANE_META) return value as DevelopmentLaneId;
  return null;
}

export default async function MentorshipHubPage({
  searchParams,
}: {
  searchParams?: { view?: string; who?: string; lane?: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [], adminSubtypes = [] } = session.user;
  const isInternal =
    INTERNAL_ROLES.has(primaryRole ?? "") ||
    roles.some((role) => INTERNAL_ROLES.has(role));
  if (!isInternal) redirect("/");

  const views = await loadHubViews(userId);
  const view = parseHubView(searchParams?.view, views);
  const meta = HUB_VIEW_META[view];

  const isAdminView = view === "admin";
  const who = searchParams?.who === "officers" ? "officers" : "instructors";

  return (
    <div className={`${skin.portalSkin} mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-1 pb-12 pt-2`}>
      <PageHeaderV2
        eyebrow="Leadership development"
        title="Mentorship"
        subtitle={meta.blurb}
        actions={
          isAdminView ? (
            <div className="flex items-center gap-2">
              <ButtonLink href="/people/develop/reviews" variant="secondary" size="sm">
                Review cycles
              </ButtonLink>
              <ButtonLink href="/people/develop/reviews/new" variant="primary" size="sm">
                Start a review
              </ButtonLink>
              <ButtonLink href="/admin/mentorship" variant="secondary" size="sm">
                Program admin
              </ButtonLink>
            </div>
          ) : view === "mentees" ? (
            <ButtonLink href="/people/develop/reviews" variant="secondary" size="sm">
              Review cycles
            </ButtonLink>
          ) : undefined
        }
      />

      <HubSwitcher views={views} active={view} />

      {view === "me" ? (
        <MenteeHomeView data={await loadMenteeHome(userId)} />
      ) : null}

      {view === "mentees" ? (
        <MentorConsoleView
          data={await loadMentorConsole(userId, {
            isAdmin: roles.includes("ADMIN"),
            adminSubtypes: adminSubtypes as string[],
          })}
        />
      ) : null}

      {isAdminView ? (
        <DevelopmentCockpit
          overview={await loadDevelopmentOverview(
            who === "officers" ? "officer" : "instructor"
          )}
          who={who}
          laneFilter={parseLane(searchParams?.lane)}
        />
      ) : null}
    </div>
  );
}
