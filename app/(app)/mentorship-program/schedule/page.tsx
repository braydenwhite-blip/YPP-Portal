import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Meeting Requests — Mentorship Program" };

// Legacy URL. Canonical is /mentorship/schedule.
export default function MentorSchedulePage() {
  permanentRedirect("/mentorship/schedule");
}
