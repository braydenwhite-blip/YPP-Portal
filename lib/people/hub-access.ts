import { hasRole } from "@/lib/authorization-roles";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import {
  isLeadershipOrBoard,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

/** Which People hub tabs the viewer may see. */
export function getPeopleHubAccess(viewer: ActionViewer) {
  return {
    showPerformance:
      isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer),
    showClasses: hasRole(viewer.roles, "ADMIN", viewer.primaryRole ?? null),
  };
}
