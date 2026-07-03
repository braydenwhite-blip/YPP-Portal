import { redirect } from "next/navigation";

/**
 * The mentor's per-mentee surface is now the unified Mentorship workspace.
 * Redirect the old RelationshipWorkspace route into it; the mentor's authoring
 * tools (review cycle, next steps) ride along on the workspace, and the `/gr`
 * sub-route (Goals & Resources) stays live underneath this path.
 */
export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mentorship/people/${id}`);
}
