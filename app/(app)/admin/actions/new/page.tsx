import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

// Action creation now lives inside the Action Tracker at /actions/new (Phase 3).
// This legacy admin route redirects so old links / bookmarks keep working.
export default async function LegacyNewActionRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/actions/new", await searchParams));
}
