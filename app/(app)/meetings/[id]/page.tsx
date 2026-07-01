import skin from "@/components/ui-v2/portal-skin.module.css";
import { SimpleSurface } from "@/components/command-center/simple";
import { MeetingRunner } from "@/components/weekly-meetings/meeting-runner";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { getMeeting } from "@/lib/weekly-meetings/meetings";
import { listMeetingPartnerOptions } from "@/lib/weekly-meetings/partners";
import { listAssignableUsers } from "@/lib/weekly-meetings/teams";
import { getWorkflowContextForMeeting } from "@/lib/workflow-engine/meeting-sync";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireMeetingRunner();
  const { id } = await params;
  const [meeting, people, partners, workflowContext] = await Promise.all([
    getMeeting(id),
    listAssignableUsers(),
    listMeetingPartnerOptions(),
    getWorkflowContextForMeeting(id),
  ]);
  if (!meeting) notFound();

  return (
    <div className={skin.portalSkin}>
      <SimpleSurface maxWidth={720}>
        <MeetingRunner
          meeting={meeting}
          people={people}
          partners={partners}
          currentUserId={viewer.id}
          workflowContext={workflowContext}
        />
      </SimpleSurface>
    </div>
  );
}
