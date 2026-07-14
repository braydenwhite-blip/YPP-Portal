import { redirect } from "next/navigation";

export const metadata = { title: "Mentor Schedule — YPP Mentorship" };

/**
 * Mentorship no longer has a separate scheduler — meetings are logged on each
 * person's workspace. Old bookmarks land on the mentor console.
 */
export default function MentorshipSchedulePage() {
  redirect("/mentorship?view=mentor");
}
