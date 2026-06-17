import { notFound, redirect } from "next/navigation";

import { MeetingCreateForm } from "@/components/command-center/meeting-create-form";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import { SimpleSurface, SimpleActionStrip, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import {
  areaForRelatedEntityType,
  normalizeRelatedEntityType,
} from "@/lib/people-strategy/operational-context";
import type { MeetingPrefill } from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "New meeting · Work" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    relatedType?: string;
    relatedId?: string;
    title?: string;
    purpose?: string;
    area?: string;
  }>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const sp = (await searchParams) ?? {};
  const prefillType = normalizeRelatedEntityType(sp.relatedType);
  const prefillId = sp.relatedId?.trim() || null;
  const titleParam = typeof sp.title === "string" ? sp.title.trim().slice(0, 300) : "";
  const purposeParam = typeof sp.purpose === "string" ? sp.purpose.trim().slice(0, 2000) : "";
  const areaParam =
    sp.area && isMeetingCategory(sp.area.trim().toUpperCase())
      ? sp.area.trim().toUpperCase()
      : null;

  let meetingPrefill: MeetingPrefill | undefined;
  if (prefillType && prefillId) {
    const summary = await loadRelatedEntitySummary(prefillType, prefillId).catch(() => null);
    if (summary) {
      meetingPrefill = {
        category: areaParam ?? areaForRelatedEntityType(prefillType),
        relatedEntityType: prefillType,
        relatedEntityId: prefillId,
        relatedEntityLabel: summary.label,
        title: titleParam || null,
        purpose: purposeParam || null,
      };
    }
  } else if (titleParam || purposeParam || areaParam) {
    meetingPrefill = {
      category: areaParam,
      title: titleParam || null,
      purpose: purposeParam || null,
    };
  }

  const assignableUsers = await listActionAssignableUsers();
  const people = assignableUsers.map((u) => ({
    id: u.id,
    name: personName(u),
  }));

  const pageTitle = meetingPrefill?.relatedEntityLabel
    ? `Meeting for ${meetingPrefill.relatedEntityLabel}`
    : "Schedule a meeting";
  const pageSubtitle = meetingPrefill?.relatedEntityLabel
    ? "This meeting will link back to that record when you save."
    : "Title, date, and who's involved — under a minute.";

  const strip: SimpleAction[] = [
    { label: "All meetings", href: "/actions/meetings", icon: "calendar" },
    { label: "Add action", href: "/actions/new", icon: "bolt" },
  ];

  return (
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="Work"
          backHref="/actions/meetings"
          backLabel="Meetings"
          title={pageTitle}
          subtitle={pageSubtitle}
          actions={<CommandModeToggle />}
        />
      }
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <MeetingCreateForm people={people} prefill={meetingPrefill} cancelHref="/actions/meetings" />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
  );
}
