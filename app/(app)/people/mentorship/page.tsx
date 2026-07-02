import { redirect } from "next/navigation";

import {
  appendSearchParams,
  type RedirectSearchParams,
} from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * The People-hub mentorship dashboard folded into the unified Mentorship
 * Command Center — one command center, not three.
 */
export default async function LegacyPeopleMentorshipRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(
    appendSearchParams("/mentorship", { view: "admin", ...(await searchParams) })
  );
}
