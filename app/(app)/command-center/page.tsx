import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * The "Command Center" concept was retired in the navigation overhaul. Home is
 * now the single starting point ("what do I need to know or do today"), so old
 * /command-center links land on Home.
 */
export default async function LegacyCommandCenterRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/", await searchParams));
}
