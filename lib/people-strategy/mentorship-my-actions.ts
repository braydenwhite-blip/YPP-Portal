import { prisma } from "@/lib/prisma";

/**
 * People Strategy — surfaces a person's open MentorshipActionItems alongside
 * their tracker actions on /my-actions (#12). Read-only: mentorship action
 * items are owned by the Mentorship system, we never copy them into the
 * ActionItem table. We include items where the viewer is the owner OR the
 * mentee, and treat "open" as "not yet completed" (robust to enum changes).
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
  const items = await prisma.mentorshipActionItem.findMany({
    where: {
      completedAt: null,
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

  return items.map((i) => ({
    id: i.id,
    title: i.title,
    details: i.details,
    dueAt: i.dueAt,
    role: i.ownerId === userId ? "owner" : "mentee",
    menteeName: i.mentee?.name ?? i.mentee?.email ?? null,
  }));
}
