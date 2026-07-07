import { redirect } from "next/navigation";

import {
  appendSearchParams,
  type RedirectSearchParams,
} from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";
// Stable heading asserted by nightly smoke tests; the merged surface keeps it.
export const ADMIN_MENTORSHIP_PAGE_TITLE = "Mentorship Admin";
export const metadata = { title: "Mentorship Admin — Pathways Portal" };

/**
 * The admin mentorship cockpit folded into the unified Mentorship hub — the
 * eight-tab surface now renders at /mentorship?view=admin (see
 * `_components/admin-cockpit.tsx`). Deep detail routes under this segment
 * (relationships/, applications/, gr/) keep their URLs. `tab`, `lane`, and the
 * matching params are forwarded so old deep links land on the right tab.
 */
export default async function LegacyAdminMentorshipRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(
    appendSearchParams("/mentorship", { view: "admin", ...(await searchParams) })
  );
}
