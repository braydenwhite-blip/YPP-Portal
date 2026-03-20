"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseBackedPathwayStepsThroughOrder } from "@/lib/pathway-logic";

export async function registerForPathwayEvent(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  const event = await prisma.pathwayEvent.findUnique({
    where: { id: eventId },
    include: {
      registrations: {
        select: { userId: true },
      },
      pathway: {
        select: {
          steps: {
            select: {
              id: true,
              stepOrder: true,
              title: true,
              courseId: true,
            },
            orderBy: { stepOrder: "asc" },
          },
        },
      },
    },
  });
  if (!event) return { error: "Event not found" };

  const existing = event.registrations.some(
    (registration) => registration.userId === session.user.id
  );
  if (existing) return { success: true };

  if (event.eventDate && event.eventDate.getTime() < Date.now()) {
    return { error: "This event has already happened." };
  }

  if (
    event.maxAttendees != null &&
    event.registrations.length >= event.maxAttendees
  ) {
    return { error: "This event is already full." };
  }

  if (event.requiredStepOrder != null) {
    const hasMatchingStep = event.pathway.steps.some(
      (step) => step.stepOrder === event.requiredStepOrder
    );
    if (!hasMatchingStep) {
      return { error: "This event is linked to a pathway step that no longer exists." };
    }

    const requiredCourseSteps = getCourseBackedPathwayStepsThroughOrder(
      event.pathway.steps,
      event.requiredStepOrder
    );
    if (requiredCourseSteps.length > 0) {
      const completedEnrollments = await prisma.enrollment.findMany({
        where: {
          userId: session.user.id,
          courseId: {
            in: requiredCourseSteps.map((step) => step.courseId),
          },
          status: "COMPLETED",
        },
        select: { courseId: true },
      });
      const completedCourseIds = new Set(
        completedEnrollments.map((enrollment) => enrollment.courseId)
      );
      const hasCompletedRequirement = requiredCourseSteps.every((step) =>
        completedCourseIds.has(step.courseId)
      );

      if (!hasCompletedRequirement) {
        return { error: "Complete the required pathway step before registering." };
      }
    }
  }

  await prisma.pathwayEventRegistration.create({
    data: { eventId, userId: session.user.id },
  });

  return { success: true };
}

export async function unregisterFromPathwayEvent(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  await prisma.pathwayEventRegistration.deleteMany({
    where: { eventId, userId: session.user.id },
  });

  return { success: true };
}

export async function createPathwayEvent(data: {
  pathwayId: string;
  title: string;
  description?: string;
  eventDate?: Date;
  locationOrLink?: string;
  maxAttendees?: number;
  requiredStepOrder?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!(session.user.roles ?? []).includes("ADMIN")) return { error: "Unauthorized" };

  const pathway = await prisma.pathway.findUnique({
    where: { id: data.pathwayId },
    select: { id: true },
  });
  if (!pathway) return { error: "Pathway not found." };

  if (data.requiredStepOrder != null) {
    const requiredStep = await prisma.pathwayStep.findFirst({
      where: {
        pathwayId: data.pathwayId,
        stepOrder: data.requiredStepOrder,
      },
      select: {
        id: true,
        courseId: true,
      },
    });

    if (!requiredStep?.courseId) {
      return { error: "Required event steps must point to a course-backed pathway step." };
    }
  }

  const event = await prisma.pathwayEvent.create({ data });
  return { success: true, event };
}
