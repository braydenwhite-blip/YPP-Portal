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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Queue runner — Pathways Portal",
};

/** A sensible "what to clear next" cycle after each session. */
const NEXT_QUEUE: Record<QueueKey, QueueKey> = {
  leadership: "quick-wins",
  "quick-wins": "decisions",
  decisions: "meeting-prep",
  "meeting-prep": "post-meeting",
  "post-meeting": "unblock",
  unblock: "owner-accountability",
  "owner-accountability": "initiative-cleanup",
  "initiative-cleanup": "weekly-review",
  "weekly-review": "my",
  my: "leadership",
  waiting: "leadership",
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
  const key: QueueKey = isQueueKey(queueParam) ? queueParam : "leadership";

  const now = new Date();
  const data = await loadWorkHub(viewer, { now });
  const engine = buildQueueEngine(data, now);
  const items = getEngineQueue(engine, key, now);

  const nextKey = NEXT_QUEUE[key];

  return (
    <WorkspaceShell className="px-1">
      <QueueRunner
        queueLabel={QUEUE_DESCRIPTORS[key].label}
        items={items}
        nextQueueHref={`/work/queue?queue=${nextKey}`}
        nextQueueLabel={QUEUE_DESCRIPTORS[nextKey].label}
      />
    </WorkspaceShell>
  );
}
