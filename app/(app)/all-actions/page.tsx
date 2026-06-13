import { redirect } from "next/navigation";

import type { RedirectSearchParams } from "@/lib/navigation/redirect-search-params";
export const dynamic = "force-dynamic";

export default async function LegacyAllActionsRedirect({
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
