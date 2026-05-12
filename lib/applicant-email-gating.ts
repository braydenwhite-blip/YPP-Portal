/**
 * Gates the legacy "send applicant-facing email" call sites in
 * `lib/instructor-application-actions.ts`. When the application's source is
 * not PORTAL, the auto-send is suppressed and a ManualEmailTask is upserted
 * so the admin sees a clear "send this manually" surface instead.
 *
 * Internal-to-staff emails (reviewer-assigned, interviewer-assigned,
 * chair-queued) are unaffected — they still fire regardless of source.
 *
 * Admin-triggered "resend" actions (e.g. resendChairDecisionEmail) are also
 * unaffected — those are explicit overrides.
 */

import { ApplicationSource, ApplicationTrack, ManualEmailKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildManualEmailTemplate } from "@/lib/application-source-config";

// ─── Public predicate ────────────────────────────────────────────────────────

/**
 * Whether the portal may auto-send an applicant-facing email for a given
 * application source. Defaults to true (auto-send) for null/undefined so
 * pre-migration rows are treated as portal-native.
 */
export function shouldAutoSendApplicantEmail(
  source: ApplicationSource | null | undefined,
): boolean {
  if (!source) return true;
  return source === "PORTAL";
}

// ─── Suppression helper ──────────────────────────────────────────────────────

export interface SuppressionContext {
  applicationId: string;
  applicantName: string | null;
  applicationTrack: ApplicationTrack | string | null;
  /** Optional reason override for the timeline audit row. */
  reason?: string;
  /** Optional rationale or message body the admin authored (e.g. infoRequest text). */
  contextNote?: string | null;
}

/**
 * Upsert a PENDING ManualEmailTask for the given application + kind. If a
 * task of the same kind already exists, we refresh the suggested template
 * (so the admin always sees a current draft) and append the contextNote to
 * the notes field. The timeline records the suppression so admins can see
 * exactly which auto-emails were skipped.
 *
 * Returns the task id.
 */
export async function recordSuppressedApplicantEmail(
  kind: ManualEmailKind,
  ctx: SuppressionContext,
): Promise<string> {
  const template = buildManualEmailTemplate(kind, {
    applicantName: ctx.applicantName,
    applicationLabel: applicationLabelFromTrack(ctx.applicationTrack),
  });

  const existing = await prisma.manualEmailTask.findFirst({
    where: { instructorApplicationId: ctx.applicationId, kind },
    select: { id: true, notes: true, status: true },
  });

  const noteAppend = ctx.contextNote?.trim() || null;

  let taskId: string;
  if (existing) {
    const combinedNotes = noteAppend
      ? existing.notes
        ? `${existing.notes}\n\n${noteAppend}`
        : noteAppend
      : existing.notes;
    await prisma.manualEmailTask.update({
      where: { id: existing.id },
      data: {
        suggestedSubject: template.subject,
        suggestedBody: template.body,
        notes: combinedNotes,
        // Only reset to PENDING if the task is currently NOT_NEEDED or
        // HANDLED_EXTERNALLY (admin previously decided it didn't need to
        // send). Existing PENDING / SENT rows keep their status — admins who
        // already marked the email sent shouldn't have their work undone.
        status:
          existing.status === "NOT_NEEDED" || existing.status === "HANDLED_EXTERNALLY"
            ? "PENDING"
            : existing.status,
      },
    });
    taskId = existing.id;
  } else {
    const created = await prisma.manualEmailTask.create({
      data: {
        instructorApplicationId: ctx.applicationId,
        kind,
        suggestedSubject: template.subject,
        suggestedBody: template.body,
        notes: noteAppend,
      },
      select: { id: true },
    });
    taskId = created.id;
  }

  try {
    await prisma.instructorApplicationTimelineEvent.create({
      data: {
        applicationId: ctx.applicationId,
        kind: "AUTO_EMAIL_SUPPRESSED",
        actorId: null,
        payload: {
          emailKind: kind,
          manualEmailTaskId: taskId,
          reason: ctx.reason ?? "non_portal_source",
        },
      },
    });
  } catch (err) {
    // Timeline write failure must not break the calling action. The task
    // upsert above is the user-visible artifact.
    console.error("[recordSuppressedApplicantEmail] timeline write failed:", err);
  }

  return taskId;
}

function applicationLabelFromTrack(
  track: ApplicationTrack | string | null | undefined,
): string {
  return track === "SUMMER_WORKSHOP_INSTRUCTOR"
    ? "Summer Workshop Instructor"
    : "Instructor";
}

// ─── Wrapper helpers — call-site sugar ───────────────────────────────────────

/**
 * Run `send` only if the source is PORTAL. Otherwise, suppress and upsert
 * the matching manual email task.
 *
 * Returns true when the auto-send actually ran. False when suppressed.
 */
export async function gateApplicantEmail<T>(opts: {
  source: ApplicationSource | null | undefined;
  kind: ManualEmailKind;
  context: SuppressionContext;
  send: () => Promise<T>;
}): Promise<{ sent: boolean; result?: T }> {
  if (shouldAutoSendApplicantEmail(opts.source)) {
    const result = await opts.send();
    return { sent: true, result };
  }
  await recordSuppressedApplicantEmail(opts.kind, opts.context);
  return { sent: false };
}
