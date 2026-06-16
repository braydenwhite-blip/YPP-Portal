import { CalmOnly, ExecutiveOnly } from "@/components/command-center/command-mode";
import type { LeadershipHomeData } from "@/lib/home/leadership-home";

import { LeadershipHomeCalm } from "./leadership-home-calm";
import { LeadershipHomeExecutive } from "./leadership-home-executive";

/**
 * Leadership Home — one front door, two densities driven by the global view
 * mode. Calm (the default) is a single calm starting point: a greeting, the one
 * thing that matters most, a small queue preview, a few real counts, recent
 * changes — nobody is overwhelmed. Executive restores the full operating
 * cockpit. Both render the same loaded data; the mode just chooses how much.
 */
export function LeadershipHome({
  firstName,
  data,
}: {
  firstName: string;
  data: LeadershipHomeData;
}) {
  return (
    <>
      <CalmOnly>
        <LeadershipHomeCalm firstName={firstName} data={data} />
      </CalmOnly>
      <ExecutiveOnly>
        <LeadershipHomeExecutive firstName={firstName} data={data} />
      </ExecutiveOnly>
    </>
  );
}
