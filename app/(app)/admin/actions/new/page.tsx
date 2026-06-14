import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

// Action creation lives on /actions (inline) or /actions/new when prefilled.
export default async function LegacyNewActionRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const hasPrefill = Object.keys(params).length > 0;
  redirect(appendSearchParams(hasPrefill ? "/actions/new" : "/actions?create=1", params));
}
