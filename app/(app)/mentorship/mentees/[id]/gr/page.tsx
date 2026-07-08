import { redirect } from "next/navigation";

/**
 * The mentor's G&R view is now the workspace's Goals section — one canonical
 * place for a mentee's goals, whether you're the mentee, their mentor, or
 * leadership. See components/mentorship/workspace/goals-section.tsx.
 */
export default async function MentorMenteeGRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mentorship/people/${id}?section=goals`);
}
