import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy decision cockpit URL — merged into Application 360. */
export default async function FinalReviewCockpitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/instructor-applicants/${id}#decision`);
}
