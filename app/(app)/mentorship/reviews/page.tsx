import { redirect } from "next/navigation";

/**
 * The Monthly Review Inbox folded into the Mentorship home — the "waiting on
 * your approval" queue renders there directly (see
 * app/(app)/mentorship/_components/approval-queues.tsx), so chairs have one
 * place instead of a separate inbox destination. Kept as a redirect for old
 * links, notifications, and bookmarks.
 */
export default function LegacyReviewInboxRedirect() {
  redirect("/mentorship?view=mentor");
}
