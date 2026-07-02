import { redirect } from "next/navigation";

import {
  appendSearchParams,
  type RedirectSearchParams,
} from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * "My Mentor" is now the mentee POV of the unified Mentorship hub. The
 * detail subroutes (goals, progress, reflection, schedule, resources,
 * awards, help, apply) still live under /my-mentor/*.
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
