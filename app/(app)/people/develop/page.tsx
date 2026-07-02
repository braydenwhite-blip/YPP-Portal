import { redirect } from "next/navigation";

import {
  appendSearchParams,
  type RedirectSearchParams,
} from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * The Leadership Development cockpit moved into the unified Mentorship
 * Command Center (admin POV). `who`/`lane` filters carry through.
 */
export default async function LegacyDevelopRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(
    appendSearchParams("/mentorship", { view: "admin", ...(await searchParams) })
  );
}
