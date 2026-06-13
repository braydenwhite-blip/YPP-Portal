import { redirect } from "next/navigation";

import { isActionTrackerEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Responsibility Map folded into the main Actions page. */
export default async function ResponsibilityMapRedirect() {
  if (!isActionTrackerEnabled()) redirect("/");
  redirect("/actions?who=all");
}
