import { redirect } from "next/navigation";

export default async function ImpactMeetingDetailAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/meetings/${id}`);
}
