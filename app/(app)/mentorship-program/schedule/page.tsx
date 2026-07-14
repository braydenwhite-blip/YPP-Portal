import { permanentRedirect } from "next/navigation";

// Legacy URL. Mentorship scheduling was retired — meetings live on the person workspace.
export default function LegacyMentorshipProgramSchedulePage() {
  permanentRedirect("/mentorship?view=mentor");
}
