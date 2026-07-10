import { redirect } from "next/navigation";

/**
 * The mentor's per-mentee surface is now the unified Mentorship workspace.
 * Redirect the old RelationshipWorkspace route into it; the mentor's authoring
 * tools, review cycle, goals, and next steps all live in the same destination.
 */
export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mentorship/people/${id}`);
}
