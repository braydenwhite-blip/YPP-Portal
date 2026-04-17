import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Meeting Requests — Mentorship Program" };

// Permanent redirect: canonical URL is /my-program/schedule.
export default function MentorSchedulePage() {
  permanentRedirect("/my-program/schedule");
}
