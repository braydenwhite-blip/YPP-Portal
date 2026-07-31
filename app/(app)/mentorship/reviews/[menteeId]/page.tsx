import { redirect } from "next/navigation";

/**
 * Retired: writing a monthly progress update happens on Progress
 * (`?section=progress`), not a separate route.
 */
export default async function MonthlyReviewEditorRedirect({
  params,
}: {
  params: Promise<{ menteeId: string }>;
}) {
  const { menteeId } = await params;
  redirect(`/mentorship/people/${menteeId}?section=progress`);
}
