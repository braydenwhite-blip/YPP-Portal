"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";
import { syncPartnerSearchDocument } from "@/lib/help-agent/search-indexing";
import { whereActiveMember } from "@/lib/user-role-where";
import {
  asPartnerStage,
  asPartnerPriority,
  asPartnerType,
  asPartnerNoteKind,
  partnerStageLabel,
} from "@/lib/partners-constants";

/**
 * Partners — admin CRUD + pipeline mutations.
 *
 * Phase 4 extends the original directory CRUD with pipeline fields, a stage
 * mover, and an append-only note/timeline. All mutations are ADMIN-only. Updates
 * are *field-presence-aware*: a form only writes the keys it actually submits, so
 * the legacy simple edit form never clears the richer pipeline fields (and the
 * profile form never disturbs fields it doesn't render).
 */

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalInt(formData: FormData, key: string): number | null {
  if (!formData.has(key)) return null;
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function getOptionalDate(formData: FormData, key: string): Date | null {
  if (!formData.has(key)) return null;
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolve an optional relationship-lead id to a valid active member, or null. */
async function resolveRelationshipLeadId(raw: string): Promise<string | null> {
  if (!raw) return null;
  const lead = await prisma.user.findFirst({
    where: { id: raw, archivedAt: null, ...whereActiveMember() },
    select: { id: true },
  });
  if (!lead) {
    throw new Error("Relationship Lead must be an active portal member.");
  }
  return lead.id;
}

/** Text field: present + empty → null (clear); absent → omitted from the update. */
function applyTextField(
  data: Prisma.PartnerUpdateInput,
  formData: FormData,
  key: keyof Prisma.PartnerUpdateInput & string
) {
  if (!formData.has(key)) return;
  const raw = String(formData.get(key) ?? "").trim();
  (data as Record<string, unknown>)[key] = raw === "" ? null : raw;
}

/** Build a partial Partner update from whichever keys the form submitted. */
async function buildPartnerUpdateData(
  formData: FormData
): Promise<Prisma.PartnerUpdateInput> {
  const data: Prisma.PartnerUpdateInput = {};

  if (formData.has("name")) {
    const name = getString(formData, "name");
    data.name = name;
  }
  applyTextField(data, formData, "type");
  applyTextField(data, formData, "website");
  applyTextField(data, formData, "notes");
  applyTextField(data, formData, "source");
  applyTextField(data, formData, "contactName");
  applyTextField(data, formData, "contactTitle");
  applyTextField(data, formData, "contactEmail");
  applyTextField(data, formData, "contactPhone");
  applyTextField(data, formData, "location");
  applyTextField(data, formData, "requestedSubjects");
  applyTextField(data, formData, "requestedAgeGroups");
  applyTextField(data, formData, "requestedDates");
  applyTextField(data, formData, "programFormat");
  applyTextField(data, formData, "constraints");
  applyTextField(data, formData, "outcome");

  if (formData.has("stage")) {
    data.stage = asPartnerStage(getString(formData, "stage", false));
  }
  if (formData.has("priority")) {
    data.priority = asPartnerPriority(getString(formData, "priority", false));
  }
  if (formData.has("partnerType")) {
    data.partnerType = asPartnerType(getString(formData, "partnerType", false));
  }
  if (formData.has("expectedStudents")) {
    data.expectedStudents = getOptionalInt(formData, "expectedStudents");
  }
  if (formData.has("instructorCountNeeded")) {
    data.instructorCountNeeded = getOptionalInt(formData, "instructorCountNeeded");
  }
  if (formData.has("lastContactedAt")) {
    data.lastContactedAt = getOptionalDate(formData, "lastContactedAt");
  }
  if (formData.has("nextFollowUpAt")) {
    data.nextFollowUpAt = getOptionalDate(formData, "nextFollowUpAt");
  }
  if (formData.has("meetingDate")) {
    data.meetingDate = getOptionalDate(formData, "meetingDate");
  }
  if (formData.has("relationshipLeadId")) {
    const leadId = await resolveRelationshipLeadId(
      getString(formData, "relationshipLeadId", false)
    );
    data.relationshipLead = leadId
      ? { connect: { id: leadId } }
      : { disconnect: true };
  }

  return data;
}

export async function createPartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = getString(formData, "name");
  const type = getString(formData, "type", false) || null;
  const website = getString(formData, "website", false) || null;
  const notes = getString(formData, "notes", false) || null;
  const relationshipLeadId = await resolveRelationshipLeadId(
    getString(formData, "relationshipLeadId", false)
  );
  const stage = asPartnerStage(getString(formData, "stage", false));
  const priority = asPartnerPriority(getString(formData, "priority", false));
  const partnerType = asPartnerType(getString(formData, "partnerType", false));

  const partner = await prisma.partner.create({
    data: { name, type, website, notes, relationshipLeadId, stage, priority, partnerType },
  });
  await syncPartnerSearchDocument(partner.id);

  revalidatePath("/admin/partners");
}

export async function updatePartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = getString(formData, "id");
  const data = await buildPartnerUpdateData(formData);
  await prisma.partner.update({ where: { id }, data });
  await syncPartnerSearchDocument(id);

  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${id}`);
}

/** Move a partner to a new pipeline stage and record it on the timeline. */
export async function updatePartnerStage(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = getString(formData, "id");
  const stage = asPartnerStage(getString(formData, "stage"));

  await prisma.$transaction([
    prisma.partner.update({ where: { id }, data: { stage } }),
    prisma.partnerNote.create({
      data: {
        partnerId: id,
        authorId: admin.id,
        kind: "STAGE_CHANGE",
        body: `Stage moved to "${partnerStageLabel(stage)}".`,
      },
    }),
  ]);

  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${id}`);
}

/**
 * Add a timeline note / touchpoint. A touchpoint kind (FOLLOW_UP, MEETING, CALL,
 * OUTCOME) stamps `lastContactedAt = now`. An optional `nextFollowUpAt` schedules
 * the next step in the same submit, so a follow-up can never silently go cold.
 */
export async function addPartnerNote(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = getString(formData, "id");
  const kind = asPartnerNoteKind(getString(formData, "kind", false));
  const body = getString(formData, "body");
  const nextFollowUpAt = getOptionalDate(formData, "nextFollowUpAt");

  const isTouchpoint = kind === "FOLLOW_UP" || kind === "MEETING" || kind === "OUTCOME";

  const partnerData: Prisma.PartnerUpdateInput = {};
  if (isTouchpoint) partnerData.lastContactedAt = new Date();
  if (formData.has("nextFollowUpAt")) partnerData.nextFollowUpAt = nextFollowUpAt;

  await prisma.$transaction([
    prisma.partnerNote.create({
      data: { partnerId: id, authorId: admin.id, kind, body },
    }),
    ...(Object.keys(partnerData).length > 0
      ? [prisma.partner.update({ where: { id }, data: partnerData })]
      : []),
  ]);

  revalidatePath(`/admin/partners/${id}`);
  revalidatePath("/admin/partners");
}

export async function archivePartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = getString(formData, "id");
  await prisma.partner.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  // Archived partners leave the index (the sync removes the row).
  await syncPartnerSearchDocument(id);

  revalidatePath("/admin/partners");
}

/** Attach (or clear, when partnerId is blank) a Partner on a class offering. */
export async function setClassPartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const offeringId = getString(formData, "offeringId");
  const partnerIdRaw = getString(formData, "partnerId", false);
  const partnerId = partnerIdRaw || null;

  if (partnerId) {
    const partner = await prisma.partner.findFirst({
      where: { id: partnerId, archivedAt: null },
      select: { id: true },
    });
    if (!partner) throw new Error("Partner not found.");
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { partnerId },
  });

  revalidatePath(`/admin/classes/${offeringId}`);
}
