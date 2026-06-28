"use server";

import { prisma } from "@/lib/prisma";

/** Partner picker options for meeting create / runner. */
export async function listMeetingPartnerOptions() {
  return prisma.partner.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}
