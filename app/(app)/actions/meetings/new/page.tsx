import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

/**
 * Canonical "new meeting" deep-link used across the People-Strategy surfaces and
 * documented in docs/MEETINGS_TRACKER.md as the full-page creation flow for
 * mobile/direct links. The form itself lives at /meetings/new, so this forwards
 * there while preserving any prefill query params (relatedType/relatedId, etc.).
 */
export default async function NewMeetingRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/meetings/new", await searchParams));
}
