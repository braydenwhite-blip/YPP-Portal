import { prisma } from "@/lib/prisma";

/**
 * People Strategy — surfaces a person's open mentorship next steps. Canonical
 * rows now live in ActionItem with relatedEntityType="MENTORSHIP"; legacy
 * MentorshipActionItem rows are included only when they have not been linked
 * during the migration.
 */

export type MyMentorshipActionItem = {
  id: string;
  title: string;
  details: string | null;
  dueAt: Date | null;
  /** Whether the viewer owns the task or it's about them as the mentee. */
  role: "owner" | "mentee";
  menteeName: string | null;
};

export async function getMyMentorshipActionItems(
  userId: string
): Promise<MyMentorshipActionItem[]> {
  const canonical = await prisma.actionItem.findMany({
    where: {
      relatedEntityType: "MENTORSHIP",
      status: { notIn: ["COMPLETE", "DROPPED"] },
      OR: [{ leadId: userId }, { assignments: { some: { userId } } }],
    },
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      deadlineStart: true,
      deadlineEnd: true,
      leadId: true,
      relatedEntityId: true,
    },
  });
  const mentorshipIds = Array.from(
    new Set(
      canonical
        .map((item) => item.relatedEntityId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const mentorships =
    mentorshipIds.length > 0
      ? await prisma.mentorship.findMany({
          where: { id: { in: mentorshipIds } },
          select: {
            id: true,
            menteeId: true,
          },
        })
      : [];
  const menteeIds = Array.from(new Set(mentorships.map((item) => item.menteeId)));
  const mentees =
    menteeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: menteeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const menteeNameById = new Map(
    mentees.map((mentee) => [mentee.id, mentee.name ?? mentee.email ?? null])
  );
  const menteeByMentorshipId = new Map(
    mentorships.map((mentorship) => [
      mentorship.id,
      menteeNameById.get(mentorship.menteeId) ?? null,
    ])
  );

  const legacy = await prisma.mentorshipActionItem.findMany({
    where: {
      completedAt: null,
      linkedActionId: null,
      OR: [{ ownerId: userId }, { menteeId: userId }],
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      details: true,
      dueAt: true,
      ownerId: true,
      mentee: { select: { name: true, email: true } },
    },
  });

  return [
    ...canonical.map((item) => ({
      id: item.id,
      title: item.title,
      details: item.description,
      dueAt: item.deadlineEnd ?? item.deadlineStart,
      role: item.leadId === userId ? ("owner" as const) : ("mentee" as const),
      menteeName: item.relatedEntityId
        ? menteeByMentorshipId.get(item.relatedEntityId) ?? null
        : null,
    })),
    ...legacy.map((item) => ({
      id: item.id,
      title: item.title,
      details: item.details,
      dueAt: item.dueAt,
      role: item.ownerId === userId ? ("owner" as const) : ("mentee" as const),
      menteeName: item.mentee?.name ?? item.mentee?.email ?? null,
    })),
  ];
}
