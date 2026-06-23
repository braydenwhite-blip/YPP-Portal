import { redirect } from "next/navigation";

import { DecideWorkspace } from "@/components/command-center";
import {
  buildDecideWorkspace,
  type CcDecisionLogEntry,
  type CcMeeting,
} from "@/lib/command-center";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { buildQueueEngine } from "@/lib/queue/engine";
import { loadWorkHub } from "@/lib/work/work-hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decisions — Pathways Portal",
};

export default async function DecidePage() {
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

  const recentDecisions: CcDecisionLogEntry[] = [];

  const vm = buildDecideWorkspace({ engine, recentDecisions, now });

  const relatedMeeting: CcMeeting | null = null;

  return <DecideWorkspace vm={vm} relatedMeeting={relatedMeeting} nowISO={now.toISOString()} />;
}
