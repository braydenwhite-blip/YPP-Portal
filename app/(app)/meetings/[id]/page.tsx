import { notFound } from "next/navigation";

import { MeetingRunner } from "@/components/weekly-meetings/meeting-runner";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { getMeeting } from "@/lib/weekly-meetings/meetings";
import { listAssignableUsers } from "@/lib/weekly-meetings/teams";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMeetingRunner();
  const { id } = await params;
  const [meeting, people] = await Promise.all([getMeeting(id), listAssignableUsers()]);
  if (!meeting) notFound();

  return (
    <div className="px-1 py-2">
      <MeetingRunner meeting={meeting} people={people} />
    </div>
  );
}
