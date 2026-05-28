import { prisma } from "@/lib/prisma";
import { gateApplicantEmail } from "@/lib/applicant-email-gating";
import {
  sendInstructorInterviewReminderEmail,
  sendInterviewChoiceReminderEmail,
  type EmailResult,
} from "@/lib/email";
import { getBaseUrl } from "@/lib/portal-auth-utils";

type ReminderResult = {
  choiceReminders: number;
  reminder24: number;
  reminder2: number;
  failed: number;
};

function emailSucceeded(result: EmailResult | undefined): boolean {
  return !result || result.success !== false;
}

export async function processInstructorInterviewReminders(
  now = new Date()
): Promise<ReminderResult> {
  const result: ReminderResult = {
    choiceReminders: 0,
    reminder24: 0,
    reminder2: 0,
    failed: 0,
  };
  const baseUrl = await getBaseUrl();

  await sendChoiceReminders(now, baseUrl, result);
  await sendConfirmedInterviewReminders(now, baseUrl, result, "24-hour");
  await sendConfirmedInterviewReminders(now, baseUrl, result, "2-hour");

  return result;
}

async function sendChoiceReminders(
  now: Date,
  baseUrl: string,
  result: ReminderResult
) {
  const reminderCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const pendingSlots = await prisma.offeredInterviewSlot.findMany({
    where: {
      confirmedAt: null,
      choiceReminderSentAt: null,
      createdAt: { lte: reminderCutoff },
      scheduledAt: { gt: now },
      instructorApplication: {
        status: "INTERVIEW_SCHEDULED",
        interviewScheduledAt: null,
      },
    },
    include: {
      instructorApplication: {
        select: {
          id: true,
          source: true,
          applicationTrack: true,
          applicant: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: [{ instructorApplicationId: "asc" }, { scheduledAt: "asc" }],
    take: 300,
  });

  const slotsByApplication = new Map<string, typeof pendingSlots>();
  for (const slot of pendingSlots) {
    slotsByApplication.set(slot.instructorApplicationId, [
      ...(slotsByApplication.get(slot.instructorApplicationId) ?? []),
      slot,
    ]);
  }

  for (const [applicationId, slots] of slotsByApplication) {
    const application = slots[0]?.instructorApplication;
    if (!application?.applicant.email) continue;

    try {
      const gated = await gateApplicantEmail({
        source: application.source,
        kind: "INTERVIEW_INVITATION",
        context: {
          applicationId,
          applicantName: application.applicant.name,
          applicationTrack: application.applicationTrack,
        },
        send: () =>
          sendInterviewChoiceReminderEmail({
            to: application.applicant.email,
            applicantName: application.applicant.name,
            slots,
            statusUrl: `${baseUrl}/application-status`,
          }),
      });

      if (!emailSucceeded(gated.result as EmailResult | undefined)) {
        result.failed += 1;
        continue;
      }

      await prisma.offeredInterviewSlot.updateMany({
        where: {
          instructorApplicationId: applicationId,
          confirmedAt: null,
          choiceReminderSentAt: null,
        },
        data: { choiceReminderSentAt: now },
      });
      result.choiceReminders += 1;
    } catch (error) {
      result.failed += 1;
      console.error("[processInstructorInterviewReminders] choice reminder failed:", error);
    }
  }
}

async function sendConfirmedInterviewReminders(
  now: Date,
  baseUrl: string,
  result: ReminderResult,
  windowLabel: "24-hour" | "2-hour"
) {
  const is24Hour = windowLabel === "24-hour";
  const upperBound = new Date(
    now.getTime() + (is24Hour ? 24 : 2) * 60 * 60 * 1000
  );
  const reminderField = is24Hour ? "reminder24SentAt" : "reminder2SentAt";
  const slots = await prisma.offeredInterviewSlot.findMany({
    where: {
      confirmedAt: { not: null },
      [reminderField]: null,
      scheduledAt: {
        gt: now,
        lte: upperBound,
      },
      instructorApplication: {
        status: "INTERVIEW_SCHEDULED",
        interviewScheduledAt: { not: null },
      },
    },
    include: {
      offeredBy: { select: { id: true, name: true, email: true } },
      instructorApplication: {
        select: {
          id: true,
          source: true,
          applicationTrack: true,
          interviewRound: true,
          applicant: { select: { name: true, email: true } },
          interviewerAssignments: {
            where: { removedAt: null },
            select: {
              round: true,
              interviewer: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    take: 150,
  });

  for (const slot of slots) {
    const application = slot.instructorApplication;
    const applicant = application.applicant;
    const currentRound = application.interviewRound ?? 1;
    let ok = true;

    try {
      if (applicant.email) {
        const gated = await gateApplicantEmail({
          source: application.source,
          kind: "INTERVIEW_REMINDER",
          context: {
            applicationId: application.id,
            applicantName: applicant.name,
            applicationTrack: application.applicationTrack,
          },
          send: () =>
            sendInstructorInterviewReminderEmail({
              to: applicant.email,
              recipientName: applicant.name,
              applicantName: applicant.name,
              scheduledAt: slot.scheduledAt,
              durationMinutes: slot.durationMinutes,
              meetingDetails: slot.meetingUrl,
              detailUrl: `${baseUrl}/application-status`,
              role: "applicant",
              windowLabel,
            }),
        });
        ok = ok && emailSucceeded(gated.result as EmailResult | undefined);
      }

      const interviewers = new Map<string, { name: string | null; email: string }>();
      if (slot.offeredBy.email) {
        interviewers.set(slot.offeredBy.email, {
          name: slot.offeredBy.name,
          email: slot.offeredBy.email,
        });
      }
      for (const assignment of application.interviewerAssignments) {
        if (
          assignment.round != null &&
          assignment.round !== currentRound
        ) {
          continue;
        }
        if (assignment.interviewer.email) {
          interviewers.set(assignment.interviewer.email, {
            name: assignment.interviewer.name,
            email: assignment.interviewer.email,
          });
        }
      }

      for (const interviewer of interviewers.values()) {
        const sent = await sendInstructorInterviewReminderEmail({
          to: interviewer.email,
          recipientName: interviewer.name,
          applicantName: applicant.name,
          scheduledAt: slot.scheduledAt,
          durationMinutes: slot.durationMinutes,
          meetingDetails: slot.meetingUrl,
          detailUrl: `${baseUrl}/applications/instructor/${application.id}#section-scheduling`,
          role: "interviewer",
          windowLabel,
        });
        ok = ok && emailSucceeded(sent);
      }

      if (!ok) {
        result.failed += 1;
        continue;
      }

      await prisma.offeredInterviewSlot.update({
        where: { id: slot.id },
        data: is24Hour ? { reminder24SentAt: now } : { reminder2SentAt: now },
      });
      if (is24Hour) result.reminder24 += 1;
      else result.reminder2 += 1;
    } catch (error) {
      result.failed += 1;
      console.error("[processInstructorInterviewReminders] confirmed reminder failed:", error);
    }
  }
}
