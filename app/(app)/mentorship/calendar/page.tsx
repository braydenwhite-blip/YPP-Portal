import { permanentRedirect } from "next/navigation";

// Legacy URL. Mentorship scheduling was retired — meetings live on the person workspace.
export default function MentorshipCalendarRedirect() {
  permanentRedirect("/mentorship?view=mentor");
}
