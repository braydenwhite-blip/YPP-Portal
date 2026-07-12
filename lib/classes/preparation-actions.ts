"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireTeachingSessionAccess } from "@/lib/classes/instructor-access";
import { derivePreparation, sessionDateTime } from "@/lib/classes/instructor-state";
import { SaveSessionPreparationSchema } from "@/lib/classes/preparation";
import { preparationReviewFingerprint } from "@/lib/classes/preparation-fingerprint";

export type PreparationResult =
  | { ok: true; complete: boolean }
  | { ok: false; error: string };

function revalidateInstructorTeaching(offeringId: string) {
  revalidatePath("/");
  revalidatePath("/instructor/classes");
  revalidatePath(`/instructor/classes/${offeringId}`);
  revalidatePath("/instructor/materials");
  revalidatePath("/instructor/schedule");
}

export async function saveSessionPreparation(input: unknown): Promise<PreparationResult> {
  const parsed = SaveSessionPreparationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preparation details" };
  }
  const data = parsed.data;

  let access;
  try {
    access = await requireTeachingSessionAccess(data.sessionId, data.offeringId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unauthorized" };
  }
  const { viewer, classSession, assignment } = access;
  const isAssignedInstructor =
    classSession.offering.instructorId === viewer.id || assignment != null;
  if (!isAssignedInstructor) {
    return { ok: false, error: "Leadership preview is read-only for instructor preparation" };
  }

  if (data.lessonPlanId) {
    const lessonPlan = await prisma.lessonPlan.findFirst({
      where: {
        id: data.lessonPlanId,
        classTemplateId: classSession.offering.templateId,
      },
      select: { id: true },
    });
    if (!lessonPlan) {
      return { ok: false, error: "That lesson plan is not connected to this class curriculum" };
    }
  }

  const current = await prisma.classSession.findUnique({
    where: { id: data.sessionId },
    select: {
      sessionNumber: true,
      topic: true,
      date: true,
      startTime: true,
      endTime: true,
      lessonPlanId: true,
      notesUrl: true,
      materialsUrl: true,
      description: true,
      learningOutcomes: true,
      offering: {
        select: {
          materialsList: true,
          deliveryMode: true,
          zoomLink: true,
          locationName: true,
          locationAddress: true,
          room: true,
          timezone: true,
          enrollments: {
            select: {
              studentId: true,
              status: true,
              enrolledAt: true,
              droppedAt: true,
              signupGoal: true,
              signupNote: true,
              instructorNotes: true,
            },
          },
        },
      },
    },
  });
  if (!current) return { ok: false, error: "Session not found" };

  const nextLessonPlanId = data.lessonPlanId === undefined ? current.lessonPlanId : data.lessonPlanId;
  const nextNotesUrl = data.notesUrl === undefined ? current.notesUrl : data.notesUrl;
  const nextMaterialsUrl =
    data.materialsUrl === undefined ? current.materialsUrl : data.materialsUrl;
  const contentChanged =
    (data.lessonPlanId !== undefined && data.lessonPlanId !== current.lessonPlanId) ||
    (data.notesUrl !== undefined && data.notesUrl !== current.notesUrl) ||
    (data.materialsUrl !== undefined && data.materialsUrl !== current.materialsUrl);
  const completedAt = data.markComplete ? new Date() : null;
  const startsAt = sessionDateTime(
    current.date,
    current.startTime,
    current.offering.timezone
  );
  const rawEnd = sessionDateTime(
    current.date,
    current.endTime,
    current.offering.timezone
  );
  const endsAt = rawEnd.getTime() > startsAt.getTime()
    ? rawEnd
    : new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000);
  const expectedRoster = current.offering.enrollments.filter((enrollment) => {
    if (enrollment.status === "WAITLISTED") return false;
    if (enrollment.enrolledAt.getTime() > endsAt.getTime()) return false;
    return enrollment.droppedAt == null || enrollment.droppedAt.getTime() > startsAt.getTime();
  });
  const reviewFingerprint = preparationReviewFingerprint({
    lessonPlanId: nextLessonPlanId,
    notesUrl: nextNotesUrl,
    description: current.description,
    learningOutcomes: current.learningOutcomes,
    materialsUrl: nextMaterialsUrl,
    classMaterials: current.offering.materialsList,
    deliveryMode: current.offering.deliveryMode,
    zoomLink: current.offering.zoomLink,
    locationName: current.offering.locationName,
    locationAddress: current.offering.locationAddress,
    room: current.offering.room,
    students: expectedRoster.map((enrollment) => ({
      studentId: enrollment.studentId,
      signupGoal: enrollment.signupGoal,
      signupNote: enrollment.signupNote,
      instructorNotes: enrollment.instructorNotes,
    })),
  });
  const preparation = derivePreparation({
    id: data.sessionId,
    classId: data.offeringId,
    sessionNumber: current.sessionNumber,
    topic: current.topic,
    date: new Date(0),
    startTime: "00:00",
    endTime: "00:00",
    timezone: "UTC",
    isCancelled: false,
    notesUrl: nextNotesUrl,
    lessonPlanId: nextLessonPlanId,
    description: current.description,
    learningOutcomes: current.learningOutcomes,
    materialsUrl: nextMaterialsUrl,
    classMaterials: current.offering.materialsList,
    deliveryMode: current.offering.deliveryMode,
    zoomLink: current.offering.zoomLink,
    locationName: current.offering.locationName,
    locationAddress: current.offering.locationAddress,
    room: current.offering.room,
    activeStudentCount: 0,
    attendanceRecordCount: 0,
    reflectionDone: false,
    preparationCompletedAt: completedAt,
  });
  if (data.markComplete && !preparation.complete) {
    return { ok: false, error: preparation.incompleteReasons.join(" ") };
  }

  try {
    await prisma.$transaction([
      prisma.classSession.update({
        where: { id: data.sessionId },
        data: {
          ...(data.lessonPlanId !== undefined ? { lessonPlanId: data.lessonPlanId } : {}),
          ...(data.notesUrl !== undefined ? { notesUrl: data.notesUrl } : {}),
          ...(data.materialsUrl !== undefined ? { materialsUrl: data.materialsUrl } : {}),
        },
      }),
      prisma.instructorSessionPreparation.upsert({
        where: {
          sessionId_instructorId: {
            sessionId: data.sessionId,
            instructorId: viewer.id,
          },
        },
        create: {
          sessionId: data.sessionId,
          instructorId: viewer.id,
          lessonReviewedAt: data.markComplete ? completedAt : null,
          materialsReviewedAt: data.markComplete ? completedAt : null,
          studentContextReviewedAt: data.markComplete ? completedAt : null,
          completedAt,
          reviewFingerprint: data.markComplete ? reviewFingerprint : null,
          note: data.preparationNote,
        },
        update: {
          ...(data.markComplete
            ? {
                lessonReviewedAt: completedAt,
                materialsReviewedAt: completedAt,
                studentContextReviewedAt: completedAt,
                completedAt,
                reviewFingerprint,
              }
            : contentChanged
              ? {
                  lessonReviewedAt: null,
                  materialsReviewedAt: null,
                  studentContextReviewedAt: null,
                  completedAt: null,
                  reviewFingerprint: null,
                }
              : {}),
          ...(data.preparationNote !== undefined ? { note: data.preparationNote } : {}),
        },
      }),
    ]);
  } catch {
    return { ok: false, error: "Could not save preparation" };
  }

  revalidateInstructorTeaching(data.offeringId);
  return { ok: true, complete: data.markComplete };
}
