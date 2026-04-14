import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Review Queue — Mentorship Program" };

// Permanent redirect: canonical URL is /mentorship/reviews (Monthly Review Inbox).
export default function ReviewQueuePage() {
  permanentRedirect("/mentorship/reviews");
}
