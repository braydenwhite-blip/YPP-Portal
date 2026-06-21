import { redirect } from "next/navigation";

import type { RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * The Work "My Queue" runner was retired with the Work hub. Your actions now
 * live in one place — Actions, filtered to you — so old /work/queue links land
 * on /actions?who=me.
 */
export default async function LegacyWorkQueueRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  qs.set("who", "me");
  for (const [key, value] of Object.entries(params)) {
    if (key === "who" || key === "queue") continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value) qs.set(key, value);
  }
  redirect(`/actions?${qs.toString()}`);
}
