import { redirect } from "next/navigation";

/**
 * Retired: writing a monthly review now happens as an in-page panel on
 * /people/[id] (the "Draft review" control inside the Active Review Cycle
 * flow), not a separate route. See components/mentorship/goal-review-form.tsx
 * for the reused form.
 */
export default async function MonthlyReviewEditorRedirect({
  params,
}: {
  params: Promise<{ menteeId: string }>;
}) {
  const { menteeId } = await params;
  redirect(`/people/${menteeId}?section=review&panel=draft`);
}
