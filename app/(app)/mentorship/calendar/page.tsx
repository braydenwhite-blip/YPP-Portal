import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Mentorship Calendar — YPP" };

// Legacy URL. Canonical is /mentorship/schedule.
export default function MentorshipCalendarPage() {
  permanentRedirect("/mentorship/schedule");
}
