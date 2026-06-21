import { renderImpactMeetingPage } from "../impact-page";

export default async function ImpactMeetingAgendaAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderImpactMeetingPage(params, "agenda");
}
