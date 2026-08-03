"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { requireInstructorAssigned, type Session4Actor } from "@/lib/operational-permissions";
import { splitMeetingTimeRange } from "@/lib/class-meeting-time";

const HEX = /^#([0-9a-fA-F]{6})$/;

const WEEKDAY = z.enum([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const UpdateClassHomeSettingsSchema = z.object({
  offeringId: z.string().min(1),
  title: z.string().min(1).max(200),
  themeColor: z.string().regex(HEX, "Pick a valid hex color"),
  enrollmentOpen: z.boolean(),
  semester: z.string().max(80).optional(),
  meetingTime: z.string().max(40).optional(),
  meetingDays: z.array(WEEKDAY).max(7),
});

async function actorFor(user: { id: string; roles: string[] }): Promise<Session4Actor> {
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chapterId: true },
  });
  return {
    userId: user.id,
    roles: user.roles,
    chapterIds: full?.chapterId ? [full.chapterId] : [],
  };
}

export async function updateClassHomeSettings(formData: FormData) {
  const user = await requireSessionUser();
  const input = UpdateClassHomeSettingsSchema.parse({
    offeringId: String(formData.get("offeringId") ?? ""),
    title: String(formData.get("title") ?? ""),
    themeColor: String(formData.get("themeColor") ?? "#6b21c8"),
    enrollmentOpen: String(formData.get("enrollmentOpen") ?? "") === "on",
    semester: String(formData.get("semester") ?? "") || undefined,
    meetingTime: String(formData.get("meetingTime") ?? "") || undefined,
    meetingDays: formData.getAll("meetingDays").map(String),
  });

  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, input.offeringId);

  const meetingTime =
    input.meetingTime !== undefined ? input.meetingTime.trim() || undefined : undefined;
  const sessionClocks = meetingTime ? splitMeetingTimeRange(meetingTime) : null;

  await prisma.$transaction(async (tx) => {
    await tx.classOffering.update({
      where: { id: input.offeringId },
      data: {
        title: input.title.trim(),
        themeColor: input.themeColor.toLowerCase(),
        enrollmentOpen: input.enrollmentOpen,
        semester: input.semester?.trim() || null,
        meetingDays: input.meetingDays,
        ...(meetingTime !== undefined ? { meetingTime } : {}),
      },
    });

    // Keep upcoming session clocks aligned with class meeting time.
    if (sessionClocks) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      await tx.classSession.updateMany({
        where: {
          offeringId: input.offeringId,
          isCancelled: false,
          date: { gte: startOfToday },
        },
        data: {
          startTime: sessionClocks.startTime,
          endTime: sessionClocks.endTime,
        },
      });
    }
  });

  revalidatePath(`/instructor/classes/${input.offeringId}`);
  revalidatePath("/instructor/classes");
  revalidatePath("/instructor/schedule");
  return { ok: true as const };
}
