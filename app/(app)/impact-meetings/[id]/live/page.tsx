import { redirect } from "next/navigation";

export default async function ImpactMeetingLiveAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/actions/meetings/${id}#live`);
}
