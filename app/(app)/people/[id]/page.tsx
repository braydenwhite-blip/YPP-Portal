import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled, isOperationsHubEnabled } from "@/lib/feature-flags";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import {
  canCreateAction,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { getLeadershipContext } from "@/lib/leadership-context";
import type { LeadershipStage } from "@/lib/leadership-pathway";
import { LinkedActionsPanel } from "@/components/people-strategy/linked-actions-panel";
import { LeadershipStageContext } from "@/components/people-strategy/leadership-stage-context";
import { ProfileBody, activeLabel } from "@/components/people-strategy/profile-body";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member Profile" };

type PageProps = { params: Promise<{ id: string }> };

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Any signed-in member may view; signed-out visitors go to login.
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?next=/people/${id}`);

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  // Returns null for missing/archived/applicant-only users → 404 (never leaks
  // existence of a non-member account).
  const profile = await loadPublicProfile(id, viewer);
  if (!profile) notFound();

  // People Strategy Operating System — Action Tracker items linked to this
  // person. Additive + double-flagged; an officer-only operating panel (peers
  // viewing the public profile don't get it), visibility-filtered for the viewer.
  const showLinkedActions =
    isOperationsHubEnabled() && isActionTrackerEnabled() && isOfficerTier(viewer);

  // Phase 6 connective tissue — surface where this person sits on the Leadership
  // Pathway as context next to their linked actions (the team's prescribed
  // pattern: actions link to USER, the stage is shown as context). Loaded only
  // for the officer operating view, in parallel with the linked actions.
  let personActions: Awaited<ReturnType<typeof getActionsForEntity>> = [];
  let leadershipStage: LeadershipStage | null = null;
  let leadershipNextStage: LeadershipStage | null = null;
  if (showLinkedActions) {
    const [actions, context] = await Promise.all([
      getActionsForEntity("USER", id, viewer),
      getLeadershipContext(id),
    ]);
    personActions = actions;
    leadershipStage = context?.stage ?? null;
    leadershipNextStage = context?.nextStage ?? null;
  }

  return (
    <div className="page-shell" style={{ maxWidth: 880 }}>
      <p className="badge">Member Profile</p>

      {/* Identity header */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          padding: "20px 22px",
          margin: "8px 0 14px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "var(--ps-accent-soft)",
            color: "var(--ps-accent)",
            border: "1px solid var(--ps-border)",
            fontSize: 22,
            fontWeight: 800,
            flex: "0 0 auto",
          }}
          aria-hidden
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- existing avatar pattern.
            <img
              src={profile.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials(profile.name)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {profile.name}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {profile.title}
            {profile.chapterName ? ` · ${profile.chapterName}` : ""}
            {` · ${activeLabel(profile.monthsActive)}`}
          </p>
        </div>
      </div>

      <ProfileBody profile={profile} />

      {showLinkedActions ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <LeadershipStageContext stage={leadershipStage} nextStage={leadershipNextStage} />
          <LinkedActionsPanel
            actions={personActions}
            heading="Linked actions"
            createHref={`/actions/new?relatedType=USER&relatedId=${id}`}
            createLabel="Create action for this person"
            canCreate={canCreateAction(viewer)}
            emptyHint="No Action Tracker items are linked to this person yet."
          />
        </div>
      ) : null}
    </div>
  );
}
