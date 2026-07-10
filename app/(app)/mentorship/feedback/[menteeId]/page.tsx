import { redirect } from "next/navigation";

export default async function LegacyMentorshipFeedbackRoute({
  params,
}: {
  params: Promise<{ menteeId: string }>;
}) {
  const { menteeId } = await params;
  redirect(`/people/${menteeId}?section=review&panel=draft`);
}
