import { redirect } from "next/navigation";

/**
 * The Role Committee queue folded into the Mentorship home — the "quarterly
 * committee reviews due" queue renders there directly (see
 * app/(app)/mentorship/_components/approval-queues.tsx), viewer-scoped by
 * scopeQuarterlyQueueForViewer. Kept as a redirect for old links.
 */
export default function LegacyCommitteeQueueRedirect() {
  redirect("/mentorship?view=mentor");
}
