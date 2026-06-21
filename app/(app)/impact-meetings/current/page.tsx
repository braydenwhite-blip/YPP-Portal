import { notFound, redirect } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { findCurrentGlobalImpactMeeting } from "@/lib/people-strategy/meetings-queries";

export const dynamic = "force-dynamic";

export default async function CurrentImpactMeetingPage() {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const meeting = await findCurrentGlobalImpactMeeting(new Date());
  if (!meeting) redirect("/meetings");

  redirect(`/meetings/${meeting.id}`);
}
