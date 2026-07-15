import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Issues a class-completion certificate for a student, linked to the class
 * offering. Requires an active CertificateTemplate of type
 * COURSE_COMPLETION. Dedupes on the (recipientId, offeringId) unique
 * constraint — if a certificate already exists for this student/offering,
 * the existing row is returned instead of creating a duplicate.
 *
 * Callers must ensure the enrollment is actually COMPLETED before calling
 * this — this function asserts it internally as a safety net.
 */
export async function issueClassCompletionCertificate(offeringId: string, recipientId: string, issuedById?: string) {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { offeringId, studentId: recipientId },
    select: { status: true },
  });
  if (!enrollment || (enrollment.status !== "COMPLETED" && !(enrollment as any).completedAt)) {
    throw new Error("The student's enrollment must be completed before a certificate can be issued.");
  }

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: { template: true },
  });
  if (!offering) throw new Error("Class offering not found.");

  const template = await (prisma as any).certificateTemplate.findFirst({
    where: { type: "COURSE_COMPLETION", isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!template) throw new Error("No active course-completion certificate template is configured.");

  const title = `${offering.title ?? offering.template?.title ?? "YPP Class"} — Certificate of Completion`;

  try {
    return await prisma.certificate.create({
      data: {
        templateId: template.id,
        recipientId,
        offeringId,
        title,
        description: `Awarded for completing ${offering.title ?? offering.template?.title ?? "this class"}.`,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const existing = await prisma.certificate.findUnique({
        where: { recipientId_offeringId: { recipientId, offeringId } },
      });
      if (existing) return existing;
    }
    throw err;
  }
}
