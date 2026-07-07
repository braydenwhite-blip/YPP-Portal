import { redirect } from "next/navigation";

import {
  appendSearchParams,
  type RedirectSearchParams,
} from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * "My Mentor" is now the mentee POV of the unified Mentorship hub. The old
 * detail subroutes (goals, progress, reflection, schedule, resources, awards,
 * help) redirect to its workspace sections; only /my-mentor/apply remains.
 */
export default async function LegacyMyMentorRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(
    appendSearchParams("/mentorship", { view: "me", ...(await searchParams) })
  );
}
