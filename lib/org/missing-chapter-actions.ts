"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOfficer } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { resolveMissingChapter } from "@/lib/org/missing-chapter";

const AssignMissingChapterSchema = z.object({
  recordType: z.enum(["USER", "COURSE", "PARTNER", "CLASS_OFFERING", "MEETING"]),
  recordId: z.string().min(1),
  chapterId: z.string().min(1),
});

export async function assignMissingChapter(formData: FormData) {
  const session = await requireOfficer();
  const input = AssignMissingChapterSchema.parse({
    recordType: formData.get("recordType"),
    recordId: formData.get("recordId"),
    chapterId: formData.get("chapterId"),
  });

  const chapter = await prisma.chapter.findUnique({
    where: { id: input.chapterId },
    select: { id: true, name: true },
  });
  if (!chapter) throw new Error("Chapter not found.");

  switch (input.recordType) {
    case "USER":
      await prisma.user.update({
        where: { id: input.recordId },
        data: { chapterId: chapter.id },
      });
      break;
    case "COURSE":
      await prisma.course.update({
        where: { id: input.recordId },
        data: { chapterId: chapter.id },
      });
      break;
    case "PARTNER":
      await prisma.partner.update({
        where: { id: input.recordId },
        data: { chapterId: chapter.id },
      });
      break;
    case "CLASS_OFFERING":
      await prisma.classOffering.update({
        where: { id: input.recordId },
        data: { chapterId: chapter.id },
      });
      break;
    case "MEETING":
      // The old Meetings Tracker (OfficerMeeting) was removed — there is no
      // meeting record to assign a chapter to anymore. Resolving the queue item
      // below still clears it from the missing-chapter list.
      break;
  }

  await resolveMissingChapter({
    recordType: input.recordType,
    recordId: input.recordId,
    resolvedById: session.id,
  });

  revalidatePath("/admin/missing-chapter");
  revalidatePath("/queues");
  redirect("/admin/missing-chapter");
}
