import { renderImpactMeetingPage } from "./impact-page";

export default async function ImpactMeetingDetailAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderImpactMeetingPage(params, "overview");
}
