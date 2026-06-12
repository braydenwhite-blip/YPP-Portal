"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";
import { syncPartnerSearchDocument } from "@/lib/help-agent/search-indexing";
import { whereActiveMember } from "@/lib/user-role-where";
import {
  asPartnerAgreementKind,
  asPartnerAgreementStatus,
  asPartnerConditionStatus,
  asPartnerContactRole,
  asPartnerRequestStatus,
  PARTNER_REQUEST_TERMINAL_STATUSES,
} from "@/lib/partners-constants";

/**
 * Partner relationship operations — mutations for the Knowledge OS V2 models
 * (PartnerContact, PartnerRequest, PartnerAgreement,
 * PartnerAgreementCondition). Same conventions as lib/partners-actions.ts:
 * ADMIN-only, FormData in, vocabulary coercion from lib/partners-constants,
 * revalidate the partner database and profile.
 */

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalDate(formData: FormData, key: string): Date | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidatePartner(partnerId: string) {
  revalidatePath("/partners");
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${partnerId}`);
}

async function requirePartner(partnerId: string): Promise<void> {
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, archivedAt: null },
    select: { id: true },
  });
  if (!partner) throw new Error("Partner not found.");
}

// --- Contacts ---------------------------------------------------------------

export async function addPartnerContact(formData: FormData): Promise<void> {
  await requireAdmin();

  const partnerId = getString(formData, "partnerId");
  await requirePartner(partnerId);

  const name = getString(formData, "name");
  const title = getString(formData, "title", false) || null;
  const email = getString(formData, "email", false) || null;
  const phone = getString(formData, "phone", false) || null;
  const role = asPartnerContactRole(getString(formData, "role", false));
  const isPrimary = formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true";

  await prisma.$transaction([
    ...(isPrimary
      ? [
          prisma.partnerContact.updateMany({
            where: { partnerId, isPrimary: true },
            data: { isPrimary: false },
          }),
        ]
      : []),
    prisma.partnerContact.create({
      data: { partnerId, name, title, email, phone, role, isPrimary },
    }),
  ]);

  // Contact names/emails are partner search keywords ("find the person I met").
  await syncPartnerSearchDocument(partnerId);
  revalidatePartner(partnerId);
}

export async function setPrimaryPartnerContact(formData: FormData): Promise<void> {
  await requireAdmin();

  const contactId = getString(formData, "contactId");
  const contact = await prisma.partnerContact.findUnique({
    where: { id: contactId },
    select: { id: true, partnerId: true },
  });
  if (!contact) throw new Error("Contact not found.");

  await prisma.$transaction([
    prisma.partnerContact.updateMany({
      where: { partnerId: contact.partnerId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.partnerContact.update({
      where: { id: contactId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePartner(contact.partnerId);
}

export async function removePartnerContact(formData: FormData): Promise<void> {
  await requireAdmin();

  const contactId = getString(formData, "contactId");
  const contact = await prisma.partnerContact.findUnique({
    where: { id: contactId },
    select: { id: true, partnerId: true },
  });
  if (!contact) throw new Error("Contact not found.");

  await prisma.partnerContact.delete({ where: { id: contactId } });
  await syncPartnerSearchDocument(contact.partnerId);
  revalidatePartner(contact.partnerId);
}

// --- Requests -----------------------------------------------------------------

export async function addPartnerRequest(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const partnerId = getString(formData, "partnerId");
  await requirePartner(partnerId);

  const title = getString(formData, "title");
  const details = getString(formData, "details", false) || null;
  const dueAt = getOptionalDate(formData, "dueAt");

  // Optional owner — must be an active member when provided.
  const ownerRaw = getString(formData, "ownerId", false);
  let ownerId: string | null = null;
  if (ownerRaw) {
    const owner = await prisma.user.findFirst({
      where: { id: ownerRaw, archivedAt: null, ...whereActiveMember() },
      select: { id: true },
    });
    if (!owner) throw new Error("Request owner must be an active portal member.");
    ownerId = owner.id;
  }

  await prisma.partnerRequest.create({
    data: {
      partnerId,
      title,
      details,
      status: "OPEN",
      ownerId,
      dueAt,
      createdById: admin.id,
    },
  });

  revalidatePartner(partnerId);
}

export async function updatePartnerRequestStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const requestId = getString(formData, "requestId");
  const status = asPartnerRequestStatus(getString(formData, "status"));

  const request = await prisma.partnerRequest.findUnique({
    where: { id: requestId },
    select: { id: true, partnerId: true },
  });
  if (!request) throw new Error("Request not found.");

  await prisma.partnerRequest.update({
    where: { id: requestId },
    data: {
      status,
      resolvedAt: PARTNER_REQUEST_TERMINAL_STATUSES.includes(status) ? new Date() : null,
    },
  });

  revalidatePartner(request.partnerId);
}

// --- Agreements & conditions ---------------------------------------------------

export async function addPartnerAgreement(formData: FormData): Promise<void> {
  await requireAdmin();

  const partnerId = getString(formData, "partnerId");
  await requirePartner(partnerId);

  const title = getString(formData, "title");
  const kind = asPartnerAgreementKind(getString(formData, "kind", false));
  const status = asPartnerAgreementStatus(getString(formData, "status", false));
  const effectiveAt = getOptionalDate(formData, "effectiveAt");
  const expiresAt = getOptionalDate(formData, "expiresAt");
  const terms = getString(formData, "terms", false) || null;

  await prisma.partnerAgreement.create({
    data: { partnerId, title, kind, status, effectiveAt, expiresAt, terms },
  });

  revalidatePartner(partnerId);
}

export async function updatePartnerAgreementStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const agreementId = getString(formData, "agreementId");
  const status = asPartnerAgreementStatus(getString(formData, "status"));

  const agreement = await prisma.partnerAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, partnerId: true },
  });
  if (!agreement) throw new Error("Agreement not found.");

  await prisma.partnerAgreement.update({ where: { id: agreementId }, data: { status } });
  revalidatePartner(agreement.partnerId);
}

export async function addPartnerAgreementCondition(formData: FormData): Promise<void> {
  await requireAdmin();

  const agreementId = getString(formData, "agreementId");
  const description = getString(formData, "description");
  const dueAt = getOptionalDate(formData, "dueAt");

  const agreement = await prisma.partnerAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, partnerId: true },
  });
  if (!agreement) throw new Error("Agreement not found.");

  await prisma.partnerAgreementCondition.create({
    data: { agreementId, description, status: "PENDING", dueAt },
  });

  revalidatePartner(agreement.partnerId);
}

export async function updatePartnerConditionStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const conditionId = getString(formData, "conditionId");
  const status = asPartnerConditionStatus(getString(formData, "status"));

  const condition = await prisma.partnerAgreementCondition.findUnique({
    where: { id: conditionId },
    select: { id: true, agreement: { select: { partnerId: true } } },
  });
  if (!condition) throw new Error("Condition not found.");

  await prisma.partnerAgreementCondition.update({
    where: { id: conditionId },
    data: {
      status,
      satisfiedAt: status === "SATISFIED" ? new Date() : null,
    },
  });

  revalidatePartner(condition.agreement.partnerId);
}
