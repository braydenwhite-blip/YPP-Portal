import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

// The Action Tracker list now lives at /actions/all (People Strategy Command
// Center consolidation — Phase 5). This legacy admin mirror redirects so old
// links / bookmarks keep working.
export default async function LegacyActionsListRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/actions/all", await searchParams));
}
