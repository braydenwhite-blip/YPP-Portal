import { redirect } from "next/navigation";

import { ReviewWorkspace } from "@/components/command-center";
import { buildReviewWorkspace } from "@/lib/command-center";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { buildQueueEngine } from "@/lib/queue/engine";
import { loadWorkHub } from "@/lib/work/work-hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review — Pathways Portal",
};

export default async function ReviewPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const now = new Date();
  const data = await loadWorkHub(viewer, { now });
  const engine = buildQueueEngine(data, now);

  const vm = buildReviewWorkspace({
    engine,
    weeklyReview: data.weeklyReview,
    initiatives: data.initiatives,
    decisionsWithoutActions: data.decisionsWithoutActions,
    upcomingMeetings: data.stats.upcomingMeetings,
    now,
  });

  return <ReviewWorkspace vm={vm} />;
}
