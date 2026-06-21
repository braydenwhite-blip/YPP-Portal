import type { LeadershipHomeData } from "@/lib/home/leadership-home";

import { LeadershipHomeSections } from "./leadership-home-sections";

/**
 * Leadership Home — one calm front door, organized around the real YPP sections.
 *
 * The old executive "operating system" cockpit (and its Command Center framing)
 * was retired in the navigation overhaul. Home is now just the starting point:
 * search, what needs attention, upcoming meetings, your actions, what you opened
 * recently, quick-create, and a one-click jump into any section.
 */
export function LeadershipHome({
  firstName,
  data,
}: {
  firstName: string;
  data: LeadershipHomeData;
}) {
  return <LeadershipHomeSections firstName={firstName} data={data} />;
}
