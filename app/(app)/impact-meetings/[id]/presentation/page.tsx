import { renderImpactMeetingPage } from "../impact-page";

export default async function ImpactMeetingPresentationAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderImpactMeetingPage(params, "presentation");
}
