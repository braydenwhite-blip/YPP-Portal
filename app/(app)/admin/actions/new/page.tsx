import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

// Action creation lives on /actions/new (Calm OS page).
export default async function LegacyNewActionRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  redirect(appendSearchParams("/actions/new", params));
}
