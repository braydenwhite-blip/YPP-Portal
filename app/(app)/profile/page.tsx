import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled, isOperationsHubEnabled } from "@/lib/feature-flags";
import { getProfilePageData } from "@/lib/profile-page-data";
import { getLeadershipContext } from "@/lib/leadership-context";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import {
  canCreateAction,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { LinkedActionsPanel } from "@/components/people-strategy/linked-actions-panel";
import ProfileMain from "@/components/profile/profile-main";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.primaryRole === "INSTRUCTOR") {
    redirect("/settings/personalization");
  }

  const [user, leadership] = await Promise.all([
    getProfilePageData(session.user.id),
    getLeadershipContext(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((r) => r.role);

  // People Strategy Operating System — your own linked Action Tracker items, as
  // an on-page slice of the Operations Hub. Additive + double-flagged. Officers
  // always get the panel (with a create CTA); everyone else sees it only when
  // something is actually linked to them, so it never adds empty noise.
  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const myLinkedActions = operationsEnabled
    ? await getActionsForEntity("USER", session.user.id, viewer)
    : [];
  const showLinkedActions =
    operationsEnabled && (isOfficerTier(viewer) || myLinkedActions.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Profile</p>
          <h1 className="page-title">My Profile</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          {roles.join(" · ")}
        </div>
      </div>

      {leadership?.stageId && (
        <div style={{ marginBottom: 16 }}>
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        </div>
      )}

      {showLinkedActions && (
        <div style={{ marginBottom: 16 }}>
          <LinkedActionsPanel
            actions={myLinkedActions}
            heading="Your linked actions"
            createHref={`/actions/new?relatedType=USER&relatedId=${session.user.id}`}
            createLabel="Create an action linked to you"
            canCreate={canCreateAction(viewer)}
            emptyHint="No Action Tracker items are linked to you yet."
          />
        </div>
      )}

      <ProfileMain user={user} />
    </div>
  );
}
