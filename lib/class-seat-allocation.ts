/**
 * Race-aware seat allocation for ClassOffering.
 *
 * Class enrollment has two race-prone moments:
 *   1. Two concurrent enrollments at capacity-1 both observe a free seat and
 *      both create ENROLLED rows, leaving the offering over-capacity.
 *   2. Two concurrent drops both promote the same waitlisted student.
 *
 * Each helper wraps its read+write in `prisma.$transaction` with
 * `isolationLevel: 'Serializable'`. Postgres detects the serialization
 * conflict and aborts one of the racing transactions with SQLSTATE 40001,
 * which Prisma surfaces as `P2034`. `runSerializable` retries up to three
 * times with brief backoff; if every retry loses, the call surfaces an
 * error to the caller. Waitlist position is computed as
 * `max(waitlistPosition) + 1` over existing WAITLISTED rows.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_SERIALIZABLE_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  // Some drivers wrap the SQLSTATE differently. Accept the raw code too.
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return code === "P2034" || code === "40001";
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSerializable<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!isSerializationFailure(error)) {
        throw error;
      }
      // Brief jittered backoff before retry: 25ms, 75ms, 175ms.
      await sleep(25 * (2 ** attempt - 1) + Math.floor(Math.random() * 25));
    }
  }
  throw lastError;
}

type SeatResult = {
  enrollmentId: string;
  status: "ENROLLED" | "WAITLISTED";
  waitlisted: boolean;
  waitlistPosition: number | null;
  alreadyActive: boolean;
};

/**
 * Idempotently take a seat for `studentId` in `offeringId`.
 * - If the student already holds an active (ENROLLED or WAITLISTED) seat,
 *   returns alreadyActive: true and does not write.
 * - If the student previously DROPPED, the existing row is reused.
 * - Capacity is recounted inside the transaction; a free seat → ENROLLED,
 *   a full class → WAITLISTED with the next waitlist position.
 */
export async function takeSeatRaceSafe(args: {
  offeringId: string;
  studentId: string;
}): Promise<SeatResult> {
  const { offeringId, studentId } = args;

  return runSerializable(async (tx) => {
    const offering = await tx.classOffering.findUnique({
      where: { id: offeringId },
      select: { id: true, capacity: true },
    });
    if (!offering) {
      throw new Error("Class not found");
    }

    const existing = await tx.classEnrollment.findUnique({
      where: { studentId_offeringId: { studentId, offeringId } },
      select: { id: true, status: true },
    });

    if (existing && (existing.status === "ENROLLED" || existing.status === "WAITLISTED")) {
      return {
        enrollmentId: existing.id,
        status: existing.status,
        waitlisted: existing.status === "WAITLISTED",
        waitlistPosition: null,
        alreadyActive: true,
      };
    }

    const enrolledCount = await tx.classEnrollment.count({
      where: { offeringId, status: "ENROLLED" },
    });
    const isWaitlisted = enrolledCount >= offering.capacity;

    let waitlistPosition: number | null = null;
    if (isWaitlisted) {
      const last = await tx.classEnrollment.findFirst({
        where: { offeringId, status: "WAITLISTED" },
        orderBy: { waitlistPosition: "desc" },
        select: { waitlistPosition: true },
      });
      waitlistPosition = (last?.waitlistPosition ?? 0) + 1;
    }

    if (existing) {
      const updated = await tx.classEnrollment.update({
        where: { id: existing.id },
        data: {
          status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
          enrolledAt: new Date(),
          droppedAt: null,
          waitlistPosition,
        },
        select: { id: true },
      });
      return {
        enrollmentId: updated.id,
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        waitlisted: isWaitlisted,
        waitlistPosition,
        alreadyActive: false,
      };
    }

    const created = await tx.classEnrollment.create({
      data: {
        studentId,
        offeringId,
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        waitlistPosition,
      },
      select: { id: true },
    });
    return {
      enrollmentId: created.id,
      status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
      waitlisted: isWaitlisted,
      waitlistPosition,
      alreadyActive: false,
    };
  });
}

/**
 * Mark a student's enrollment DROPPED and, in the same transaction, promote
 * the next WAITLISTED student if a seat opened. Returns whether a promotion
 * happened so callers can revalidate notifications/UI.
 */
export async function dropAndPromoteRaceSafe(args: {
  offeringId: string;
  studentId: string;
}): Promise<{ dropped: boolean; promotedEnrollmentId: string | null }> {
  const { offeringId, studentId } = args;

  return runSerializable(async (tx) => {
    const enrollment = await tx.classEnrollment.findUnique({
      where: { studentId_offeringId: { studentId, offeringId } },
      select: { id: true, status: true },
    });
    if (!enrollment) {
      throw new Error("Not enrolled in this class");
    }
    if (enrollment.status === "DROPPED") {
      return { dropped: false, promotedEnrollmentId: null };
    }

    await tx.classEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "DROPPED",
        droppedAt: new Date(),
        waitlistPosition: null,
      },
    });

    if (enrollment.status === "ENROLLED") {
      const offering = await tx.classOffering.findUnique({
        where: { id: offeringId },
        select: { capacity: true },
      });
      if (!offering) {
        return { dropped: true, promotedEnrollmentId: null };
      }
      const enrolledCount = await tx.classEnrollment.count({
        where: { offeringId, status: "ENROLLED" },
      });
      if (enrolledCount < offering.capacity) {
        const next = await tx.classEnrollment.findFirst({
          where: { offeringId, status: "WAITLISTED" },
          orderBy: [{ waitlistPosition: "asc" }, { enrolledAt: "asc" }],
          select: { id: true },
        });
        if (next) {
          await tx.classEnrollment.update({
            where: { id: next.id },
            data: { status: "ENROLLED", waitlistPosition: null },
          });
          return { dropped: true, promotedEnrollmentId: next.id };
        }
      }
    }

    return { dropped: true, promotedEnrollmentId: null };
  });
}

/**
 * Promote the next waitlisted student to ENROLLED if a seat is open.
 * Used by admin "Promote next from waitlist" action.
 */
export async function promoteNextWaitlistedRaceSafe(args: {
  offeringId: string;
}): Promise<{ promoted: boolean; enrollmentId: string | null }> {
  const { offeringId } = args;

  return runSerializable(async (tx) => {
    const offering = await tx.classOffering.findUnique({
      where: { id: offeringId },
      select: { capacity: true },
    });
    if (!offering) {
      throw new Error("Class offering not found.");
    }
    const enrolledCount = await tx.classEnrollment.count({
      where: { offeringId, status: "ENROLLED" },
    });
    if (enrolledCount >= offering.capacity) {
      throw new Error("Class is already at capacity.");
    }
    const next = await tx.classEnrollment.findFirst({
      where: { offeringId, status: "WAITLISTED" },
      orderBy: [{ waitlistPosition: "asc" }, { enrolledAt: "asc" }],
      select: { id: true },
    });
    if (!next) {
      return { promoted: false, enrollmentId: null };
    }
    await tx.classEnrollment.update({
      where: { id: next.id },
      data: { status: "ENROLLED", waitlistPosition: null },
    });
    return { promoted: true, enrollmentId: next.id };
  });
}
