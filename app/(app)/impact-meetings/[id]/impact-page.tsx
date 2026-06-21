import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ImpactMeetingWorkspace,
  type ImpactMeetingWorkspaceView,
} from "@/components/people-strategy/impact-meeting-workspace";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadImpactMeetingRouteData } from "@/lib/people-strategy/impact-meeting-route-data";

export async function renderImpactMeetingPage(
  params: Promise<{ id: string }>,
  active: ImpactMeetingWorkspaceView
) {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { id } = await params;
  const actionViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const data = await loadImpactMeetingRouteData({
    meetingId: id,
    viewer: actionViewer,
  });
  if (!data) notFound();

  return (
    <div className={skin.portalSkin}>
      <ImpactMeetingWorkspace data={data} active={active} />
    </div>
  );
}
