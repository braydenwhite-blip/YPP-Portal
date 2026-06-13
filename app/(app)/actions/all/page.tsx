import { redirect } from "next/navigation";

import { isActionTrackerEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** All Actions lives at /actions?who=all now — one simple page. */
export default async function AllActionsRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isActionTrackerEnabled()) redirect("/");

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
