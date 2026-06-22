import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export default async function LegacyOfficerMeetingsHubRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  if (sp.new === "1") {
    // Forward create-from-context params (relatedType, relatedId, area, …) to the
    // canonical new-meeting form so "Schedule meeting" deep links keep their
    // entity link instead of opening a blank form.
    const { new: _new, ...rest } = sp;
    redirect(appendSearchParams("/actions/meetings/new", rest));
  }
  redirect("/meetings");
}
