"use server";

/**
 * Chapter Partner CRM server actions (Partner Automation, Phase 1).
 *
 * Every mutation is chapter-aware (requirePartnerAccess / requireChapterPartnerAccess)
 * so a Chapter President can run their own partner pipeline without admin rights,
 * while national leadership can operate any partner. State changes flow through
 * the deterministic transition engine (lib/partners/transitions.ts) and append to
 * the PartnerNote timeline. No email is ever sent — outreach is generated for the
 * CP to copy and send themselves.
 */

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { syncPartnerSearchDocument } from "@/lib/help-agent/search-indexing";
import {
  getPartnerScope,
  requireChapterPartnerAccess,
  requirePartnerAccess,
} from "@/lib/partners/permissions";
import {
  planEmailSent,
  planFollowUpSent,
  planResponseLogged,
  planMeetingScheduled,
  planMeetingOutcome,
  planProposalSent,
  planConfirmed,
  planClosed,
  planStageChange,
  type TransitionPlan,
} from "@/lib/partners/transitions";
import { withLogisticsItem, isLogisticsComplete, LOGISTICS_LABELS } from "@/lib/partners/logistics";
import { addBusinessDays } from "@/lib/partners/follow-up";
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  MarkEmailSentSchema,
  LogResponseSchema,
  ScheduleMeetingSchema,
  LogMeetingOutcomeSchema,
  ScheduleFollowUpSchema,
  ClosePartnerSchema,
  UpdateStageSchema,
  ToggleLogisticsSchema,
  AddNoteSchema,
  RaiseIssueSchema,
  ResolveIssueSchema,
  LogCheckInSchema,
  PartnerIdSchema,
  ImportPartnersSchema,
} from "@/lib/partners/crm-schemas";

export type ActionResult = { ok: true; id?: string; summary?: string } | { ok: false; error: string };

function revalidatePartner(id: string) {
  revalidatePath("/partners");
  revalidatePath(`/partners/${id}`);
  revalidatePath("/chapter");
}

const PARTNER_CORE_SELECT = {
  id: true,
  name: true,
  stage: true,
  contactName: true,
  logistics: true,
} satisfies Prisma.PartnerSelect;

async function partnerCore(id: string) {
  return prisma.partner.findUniqueOrThrow({ where: { id }, select: PARTNER_CORE_SELECT });
}

const asJson = (v: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined =>
  v === undefined ? undefined : (v as Prisma.InputJsonValue);

/** Apply a transition plan (field patch + timeline note) atomically. */
async function applyTransition(partnerId: string, authorId: string, plan: TransitionPlan): Promise<void> {
  await prisma.$transaction([
    prisma.partner.update({ where: { id: partnerId }, data: { ...plan.patch } }),
    prisma.partnerNote.create({
      data: {
        partnerId,
        authorId,
        kind: plan.note.kind,
        body: plan.note.body,
        metadata: asJson(plan.note.metadata),
      },
    }),
  ]);
}

// --- Create / edit ----------------------------------------------------------

export async function createChapterPartner(input: unknown): Promise<ActionResult> {
  const data = CreatePartnerSchema.parse(input);
  const scope = await getPartnerScope();
  // A CP can only create for the chapter they lead; leadership may target any
  // chapter (or none). Re-verify with the chapter guard.
  const chapterId = scope.isLeadership ? (data.chapterId ?? null) : scope.ledChapterId;
  await requireChapterPartnerAccess(chapterId);

  try {
    const partner = await prisma.partner.create({
      data: {
        name: data.name,
        partnerType: data.partnerType ?? null,
        location: data.location,
        website: data.website,
        contactName: data.contactName,
        contactTitle: data.contactTitle,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
        stage: data.stage ?? "RESEARCHING",
        priority: "MEDIUM",
        chapterId,
        relationshipLeadId: scope.user.id,
        pipelineNotes: {
          create: { authorId: scope.user.id, kind: "NOTE", body: "Added as a new partner." },
        },
      },
      select: { id: true },
    });
    await syncPartnerSearchDocument(partner.id);
    revalidatePartner(partner.id);
    return { ok: true, id: partner.id };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "A partner with this name already exists." };
    }
    return { ok: false, error: "Could not create the partner." };
  }
}

export async function updatePartner(input: unknown): Promise<ActionResult> {
  const data = UpdatePartnerSchema.parse(input);
  await requirePartnerAccess(data.partnerId);

  const patch: Prisma.PartnerUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.partnerType !== undefined) patch.partnerType = data.partnerType;
  if (data.location !== undefined) patch.location = data.location;
  if (data.website !== undefined) patch.website = data.website;
  if (data.contactName !== undefined) patch.contactName = data.contactName;
  if (data.contactTitle !== undefined) patch.contactTitle = data.contactTitle;
  if (data.contactEmail !== undefined) patch.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) patch.contactPhone = data.contactPhone;
  if (data.notes !== undefined) patch.notes = data.notes;

  await prisma.partner.update({ where: { id: data.partnerId }, data: patch });
  await syncPartnerSearchDocument(data.partnerId);
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId };
}

// --- Outreach / transitions -------------------------------------------------

async function runTransition(
  partnerId: string,
  build: (core: Awaited<ReturnType<typeof partnerCore>>, authorId: string) => TransitionPlan
): Promise<ActionResult> {
  const { user } = await requirePartnerAccess(partnerId);
  const core = await partnerCore(partnerId);
  const plan = build(core, user.id);
  await applyTransition(partnerId, user.id, plan);
  revalidatePartner(partnerId);
  return { ok: true, id: partnerId, summary: plan.summary };
}

export async function markEmailSent(input: unknown): Promise<ActionResult> {
  const data = MarkEmailSentSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) =>
    data.followUp ? planFollowUpSent(core, now) : planEmailSent(core, now)
  );
}

export async function logResponse(input: unknown): Promise<ActionResult> {
  const data = LogResponseSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planResponseLogged(core, data.body, now));
}

export async function scheduleMeeting(input: unknown): Promise<ActionResult> {
  const data = ScheduleMeetingSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planMeetingScheduled(core, data.meetingDate, now));
}

export async function logMeetingOutcome(input: unknown): Promise<ActionResult> {
  const data = LogMeetingOutcomeSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planMeetingOutcome(core, data.outcome, data.body, now));
}

export async function sendProposal(input: unknown): Promise<ActionResult> {
  const data = PartnerIdSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planProposalSent(core, now));
}

export async function confirmPartner(input: unknown): Promise<ActionResult> {
  const data = PartnerIdSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planConfirmed(core, now));
}

export async function closePartner(input: unknown): Promise<ActionResult> {
  const data = ClosePartnerSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planClosed(core, data.reason, data.body, now));
}

export async function updatePartnerStageCrm(input: unknown): Promise<ActionResult> {
  const data = UpdateStageSchema.parse(input);
  const now = new Date();
  return runTransition(data.partnerId, (core) => planStageChange(core, data.stage, now));
}

export async function scheduleFollowUp(input: unknown): Promise<ActionResult> {
  const data = ScheduleFollowUpSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  await prisma.$transaction([
    prisma.partner.update({ where: { id: data.partnerId }, data: { nextFollowUpAt: data.nextFollowUpAt } }),
    prisma.partnerNote.create({
      data: {
        partnerId: data.partnerId,
        authorId: user.id,
        kind: "FOLLOW_UP",
        body: data.note ?? `Follow-up scheduled for ${data.nextFollowUpAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
        metadata: asJson({ followUpAt: data.nextFollowUpAt.toISOString() }),
      },
    }),
  ]);
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId };
}

// --- Logistics --------------------------------------------------------------

export async function toggleLogisticsItem(input: unknown): Promise<ActionResult> {
  const data = ToggleLogisticsSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  const core = await partnerCore(data.partnerId);
  const next = withLogisticsItem(core.logistics, data.key, data.done);
  const nowComplete = isLogisticsComplete(next);

  await prisma.partner.update({
    where: { id: data.partnerId },
    data: { logistics: next as Prisma.InputJsonValue },
  });
  // Record a calm timeline note when an item is checked off, and a milestone
  // note when logistics become fully complete.
  await prisma.partnerNote.create({
    data: {
      partnerId: data.partnerId,
      authorId: user.id,
      kind: nowComplete ? "LOGISTICS_CONFIRMED" : "NOTE",
      body: nowComplete
        ? "All logistics confirmed — partner is launch-ready."
        : `Logistics ${data.done ? "confirmed" : "unchecked"}: ${LOGISTICS_LABELS[data.key]}.`,
      metadata: asJson({ key: data.key, done: data.done, complete: nowComplete }),
    },
  });
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId, summary: nowComplete ? "Logistics complete" : undefined };
}

// --- Notes / issues / check-ins ---------------------------------------------

export async function addPartnerTimelineNote(input: unknown): Promise<ActionResult> {
  const data = AddNoteSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  await prisma.partnerNote.create({
    data: { partnerId: data.partnerId, authorId: user.id, kind: "NOTE", body: data.body },
  });
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId };
}

export async function raisePartnerIssue(input: unknown): Promise<ActionResult> {
  const data = RaiseIssueSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  await prisma.partnerNote.create({
    data: {
      partnerId: data.partnerId,
      authorId: user.id,
      kind: "ISSUE",
      body: data.body,
      metadata: asJson({ severity: data.severity ?? "MEDIUM", escalated: data.escalate === true }),
    },
  });
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId, summary: data.escalate ? "Issue raised & escalated" : "Issue raised" };
}

export async function resolvePartnerIssue(input: unknown): Promise<ActionResult> {
  const data = ResolveIssueSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  await prisma.partnerNote.create({
    data: {
      partnerId: data.partnerId,
      authorId: user.id,
      kind: "ISSUE_RESOLVED",
      body: data.body ?? "Issue resolved.",
      metadata: asJson({ resolvesNoteId: data.issueNoteId }),
    },
  });
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId, summary: "Issue resolved" };
}

export async function logPartnerCheckIn(input: unknown): Promise<ActionResult> {
  const data = LogCheckInSchema.parse(input);
  const { user } = await requirePartnerAccess(data.partnerId);
  const now = new Date();
  const nextCheckIn = addBusinessDays(now, 5);
  await prisma.$transaction([
    prisma.partner.update({
      where: { id: data.partnerId },
      data: { lastContactedAt: now, nextFollowUpAt: nextCheckIn },
    }),
    prisma.partnerNote.create({
      data: {
        partnerId: data.partnerId,
        authorId: user.id,
        kind: "CHECK_IN",
        body: data.body ?? "Weekly partner check-in completed.",
        metadata: asJson({ nextCheckIn: nextCheckIn.toISOString() }),
      },
    }),
  ]);
  revalidatePartner(data.partnerId);
  return { ok: true, id: data.partnerId, summary: "Check-in logged" };
}

// --- Bulk import ------------------------------------------------------------

export async function importChapterPartners(
  input: unknown
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const data = ImportPartnersSchema.parse(input);
  const scope = await requireChapterPartnerAccess(data.chapterId);

  let created = 0;
  let skipped = 0;
  for (const row of data.rows) {
    // Partner.name is globally unique — skip a row that collides rather than fail
    // the whole import.
    const existing = await prisma.partner.findFirst({ where: { name: row.name }, select: { id: true } });
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      const partner = await prisma.partner.create({
        data: {
          name: row.name,
          type: row.type,
          location: row.location,
          website: row.website,
          contactName: row.contactName,
          contactTitle: row.contactTitle,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          notes: row.notes,
          stage: "RESEARCHING",
          priority: "MEDIUM",
          source: "Import",
          chapterId: data.chapterId,
          relationshipLeadId: scope.user.id,
        },
        select: { id: true },
      });
      await syncPartnerSearchDocument(partner.id);
      created += 1;
    } catch {
      // A race on the globally-unique Partner.name (or any per-row create error)
      // skips just that row — never aborts the whole import or leaves it in a
      // partial, opaque state.
      skipped += 1;
    }
  }

  revalidatePath("/partners");
  revalidatePath("/chapter");
  return { ok: true, created, skipped };
}
