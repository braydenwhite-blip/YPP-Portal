import { redirect } from "next/navigation";

export default async function LegacyOfficerMeetingsHubRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ new?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  if (sp.new === "1") redirect("/actions/meetings/new");
  redirect("/meetings");
}
