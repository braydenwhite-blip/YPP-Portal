import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import { getMeetingById, mapMeetingToDetailDTO } from "@/lib/people-strategy/meetings-queries";
import { MeetingDetailClient } from "@/components/people-strategy/meeting-detail-client";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meeting · Weekly Command Center" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { id } = await params;
  const now = new Date();
  const [meeting, assignableUsers] = await Promise.all([
    getMeetingById(id),
    listActionAssignableUsers(),
  ]);
  if (!meeting) notFound();

  const detail = mapMeetingToDetailDTO(meeting, now);
  const people: PersonOption[] = assignableUsers.map((u) => ({ id: u.id, name: personName(u) }));

  return (
    <div className="page-shell" style={{ maxWidth: 1280 }}>
      <MeetingDetailClient meeting={detail} people={people} />
    </div>
  );
}
