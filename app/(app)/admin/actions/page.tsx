import { redirect } from "next/navigation";

import type { RedirectSearchParams } from "@/lib/navigation/redirect-search-params";
export const dynamic = "force-dynamic";

// The Action Tracker list now lives at /actions?who=all. This legacy admin mirror
// redirects so old links / bookmarks keep working.
export default async function LegacyActionsListRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  qs.set("who", "all");
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || key === "who") continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value) qs.set(key, value);
  }
  redirect(`/actions?${qs.toString()}`);
}
