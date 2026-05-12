import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyChairReviewRedirect({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/admin/instructor-applicants/${applicationId}/review`);
}
