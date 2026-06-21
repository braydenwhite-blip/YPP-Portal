import { renderImpactMeetingPage } from "../impact-page";

export default async function ImpactMeetingLiveAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderImpactMeetingPage(params, "live");
}
