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
  isMeetingType,
  meetingOperatingModel,
} from "@/lib/people-strategy/meeting-operating-model";
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

type SearchValue = string | string[] | undefined;

function firstParam(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listParam(value: SearchValue): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

function cleanDate(value: SearchValue): string | null {
  const raw = firstParam(value)?.trim();
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function cleanTime(value: SearchValue): string | null {
  const raw = firstParam(value)?.trim();
  return raw && /^\d{2}:\d{2}$/.test(raw) ? raw : null;
}

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    relatedType?: SearchValue;
    relatedId?: SearchValue;
    title?: SearchValue;
    purpose?: SearchValue;
    area?: SearchValue;
    meetingType?: SearchValue;
    date?: SearchValue;
    start?: SearchValue;
    end?: SearchValue;
    facilitatorId?: SearchValue;
    attendeeIds?: SearchValue;
    agenda?: SearchValue;
  }>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const sp = (await searchParams) ?? {};
  const prefillType = normalizeRelatedEntityType(firstParam(sp.relatedType));
  const prefillId = firstParam(sp.relatedId)?.trim() || null;
  const titleParam = firstParam(sp.title)?.trim().slice(0, 300) ?? "";
  const purposeParam = firstParam(sp.purpose)?.trim().slice(0, 2000) ?? "";
  const rawMeetingType = firstParam(sp.meetingType)?.trim().toUpperCase();
  const meetingTypeParam = isMeetingType(rawMeetingType) ? rawMeetingType : null;
  const areaParam =
    firstParam(sp.area) && isMeetingCategory(firstParam(sp.area)?.trim().toUpperCase())
      ? firstParam(sp.area)?.trim().toUpperCase()
      : null;
  const modelCategoryParam = meetingTypeParam
    ? meetingOperatingModel(meetingTypeParam).defaultCategory
    : null;
  const dateParam = cleanDate(sp.date);
  const startParam = cleanTime(sp.start);
  const endParam = cleanTime(sp.end);
  const facilitatorIdParam = firstParam(sp.facilitatorId)?.trim() || null;
  const attendeeIdsParam = listParam(sp.attendeeIds).slice(0, 40);
  const agendaTitlesParam = listParam(sp.agenda).map((item) => item.slice(0, 180)).slice(0, 20);

  const commonPrefill = {
    meetingType: meetingTypeParam,
    date: dateParam,
    startTime: startParam,
    endTime: endParam,
    facilitatorId: facilitatorIdParam,
    attendeeIds: attendeeIdsParam,
    agendaTitles: agendaTitlesParam,
  } satisfies Partial<MeetingPrefill>;

  let meetingPrefill: MeetingPrefill | undefined;
  if (prefillType && prefillId) {
    const summary = await loadRelatedEntitySummary(prefillType, prefillId).catch(() => null);
    if (summary) {
      meetingPrefill = {
        category: areaParam ?? areaForRelatedEntityType(prefillType) ?? modelCategoryParam,
        relatedEntityType: prefillType,
        relatedEntityId: prefillId,
        relatedEntityLabel: summary.label,
        title: titleParam || null,
        purpose: purposeParam || null,
        ...commonPrefill,
      };
    }
  } else if (
    titleParam ||
    purposeParam ||
    areaParam ||
    meetingTypeParam ||
    dateParam ||
    startParam ||
    endParam ||
    facilitatorIdParam ||
    attendeeIdsParam.length > 0 ||
    agendaTitlesParam.length > 0
  ) {
    meetingPrefill = {
      category: areaParam ?? modelCategoryParam,
      title: titleParam || null,
      purpose: purposeParam || null,
      ...commonPrefill,
    };
  }

  const assignableUsers = await listActionAssignableUsers();
  const people = assignableUsers.map((u) => ({
    id: u.id,
    name: personName(u),
  }));
  const assignableIds = new Set(people.map((p) => p.id));
  if (meetingPrefill) {
    meetingPrefill = {
      ...meetingPrefill,
      facilitatorId:
        meetingPrefill.facilitatorId && assignableIds.has(meetingPrefill.facilitatorId)
          ? meetingPrefill.facilitatorId
          : null,
      attendeeIds: (meetingPrefill.attendeeIds ?? []).filter((id) => assignableIds.has(id)),
    };
  }

  const pageTitle = meetingPrefill?.relatedEntityLabel
    ? `Meeting for ${meetingPrefill.relatedEntityLabel}`
    : "Schedule a meeting";
  const pageSubtitle = meetingPrefill?.relatedEntityLabel
    ? "This meeting will link back to that record when you save."
    : "Title, date, and who's involved — under a minute.";

  const strip: SimpleAction[] = [
    { label: "All meetings", href: "/meetings", icon: "calendar" },
    { label: "Add action", href: "/actions/new", icon: "bolt" },
  ];

  return (
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="Meetings"
          backHref="/meetings"
          backLabel="Meetings"
          title={pageTitle}
          subtitle={pageSubtitle}
          actions={<CommandModeToggle />}
        />
      }
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <MeetingCreateForm people={people} prefill={meetingPrefill} cancelHref="/meetings" />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
  );
}
