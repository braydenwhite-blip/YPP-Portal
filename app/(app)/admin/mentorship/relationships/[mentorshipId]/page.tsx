import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Mentorship relationship — Admin",
};

/**
 * This admin-only relationship view is now the unified workspace: the same
 * reassign/status controls live in the leadership-only "Manage relationship"
 * disclosure on the mentee's Overview section.
 * See components/mentorship/workspace/manage-relationship.tsx.
 */
export default async function AdminMentorshipRelationshipDetailPage(props: {
  params: Promise<{ mentorshipId: string }>;
}) {
  const { mentorshipId } = await props.params;

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: { menteeId: true },
  });
  if (!mentorship) notFound();

  redirect(`/mentorship/people/${mentorship.menteeId}`);
}
