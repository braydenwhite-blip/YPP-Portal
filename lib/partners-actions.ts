"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";
import { whereActiveMember } from "@/lib/user-role-where";

/**
 * Partners — admin CRUD for the org/school partner directory introduced in
 * Phase 4 (comment #9). A Partner carries a Relationship Lead (a `User`) and can
 * be attached to any number of class offerings.
 *
 * All mutations are ADMIN-only. The Relationship Lead must be an active portal
 * member (never an applicant), enforced with `whereActiveMember()`.
 */

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
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

export async function createPartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = getString(formData, "name");
  const type = getString(formData, "type", false) || null;
  const website = getString(formData, "website", false) || null;
  const notes = getString(formData, "notes", false) || null;
  const relationshipLeadId = await resolveRelationshipLeadId(
    getString(formData, "relationshipLeadId", false)
  );

  await prisma.partner.create({
    data: { name, type, website, notes, relationshipLeadId },
  });

  revalidatePath("/admin/partners");
}

export async function updatePartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const type = getString(formData, "type", false) || null;
  const website = getString(formData, "website", false) || null;
  const notes = getString(formData, "notes", false) || null;
  const relationshipLeadId = await resolveRelationshipLeadId(
    getString(formData, "relationshipLeadId", false)
  );

  await prisma.partner.update({
    where: { id },
    data: { name, type, website, notes, relationshipLeadId },
  });

  revalidatePath("/admin/partners");
}

export async function archivePartner(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = getString(formData, "id");
  await prisma.partner.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

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
