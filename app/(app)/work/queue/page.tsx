import { redirect } from "next/navigation";

import { QueueRunner, WorkspaceShell } from "@/components/queue";
import { getSession } from "@/lib/auth-supabase";
import { buildQueueEngine, getEngineQueue } from "@/lib/queue/engine";
import { isQueueKey, QUEUE_DESCRIPTORS, type QueueKey } from "@/lib/queue/types";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { loadWorkHub } from "@/lib/work/work-hub";
import { loadMentorshipQueueItems } from "@/lib/queue/mentorship-load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Queue — Pathways Portal",
};

export default async function QueueRunnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const sp = await searchParams;
  const queueParam = typeof sp.queue === "string" ? sp.queue : undefined;
  // My Queue is the default front door — the loops you own, worst-first.
  const key: QueueKey = isQueueKey(queueParam) ? queueParam : "my";

  const now = new Date();
  const [data, mentorshipItems] = await Promise.all([
    loadWorkHub(viewer, { now }),
    loadMentorshipQueueItems(viewer, now),
  ]);
  const engine = buildQueueEngine(data, now, { mentorshipItems });
  const items = getEngineQueue(engine, key, now);

  return (
    <WorkspaceShell className="px-1">
      <QueueRunner queueLabel={QUEUE_DESCRIPTORS[key].label} items={items} />
    </WorkspaceShell>
  );
}
