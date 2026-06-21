import { redirect } from "next/navigation";

export default async function ImpactMeetingAgendaAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/meetings/${id}#during`);
}
