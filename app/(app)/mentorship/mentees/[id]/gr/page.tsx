import { redirect } from "next/navigation";

/**
 * The mentor's G&R view now lives directly on /people/[id] — the Current
 * G&R card plus the "Full G&R & check-ins" disclosure. See
 * components/people-strategy/current-gr-card.tsx.
 */
export default async function MentorMenteeGRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/people/${id}?section=review`);
}
