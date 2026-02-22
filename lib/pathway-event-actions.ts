"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function registerForPathwayEvent(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  const existing = await prisma.pathwayEventRegistration.findFirst({
    where: { eventId, userId: session.user.id },
  });
  if (existing) return { success: true };

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
  if (session.user.primaryRole !== "ADMIN") return { error: "Unauthorized" };

  const event = await prisma.pathwayEvent.create({ data });
  return { success: true, event };
}
