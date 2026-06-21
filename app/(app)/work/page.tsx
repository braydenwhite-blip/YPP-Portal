import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * The separate "Work" hub was retired in the navigation overhaul — the portal is
 * now organized around real YPP objects (People, Meetings, Actions, …) with Home
 * as the single starting point. Old /work links land on Home.
 */
export default async function LegacyWorkRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/", await searchParams));
}
