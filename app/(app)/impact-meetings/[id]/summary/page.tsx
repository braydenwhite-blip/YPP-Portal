import { renderImpactMeetingPage } from "../impact-page";

export default async function ImpactMeetingSummaryAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderImpactMeetingPage(params, "summary");
}
