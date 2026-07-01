import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * "/meet" was a retired command-center surface (it lives in the navigation's
 * ALWAYS_HIDDEN_HREFS list). A handful of command-center workspace tiles still
 * deep-link to it, so rather than 404 those links, it lands on the real
 * Meetings hub — the object section that now owns meeting work.
 */
export default async function LegacyMeetRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/meetings", await searchParams));
}
