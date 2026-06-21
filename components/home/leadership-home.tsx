import type { LeadershipHomeData } from "@/lib/home/leadership-home";

import { LeadershipHomeExecutive } from "./leadership-home-executive";

/**
 * Leadership Home — one front door. The previous calm/executive split is now a
 * single executive-style operating page with the calm focus/queue intelligence
 * embedded near the top, so leaders get both the daily next move and the full
 * operating picture without switching modes.
 */
export function LeadershipHome({
  firstName,
  data,
}: {
  firstName: string;
  data: LeadershipHomeData;
}) {
  return <LeadershipHomeExecutive firstName={firstName} data={data} />;
}
