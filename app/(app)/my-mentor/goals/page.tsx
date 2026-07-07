import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Goals — My development" };

/** Folded into the self Mentorship workspace as the Goals section. */
export default function LegacyMyMentorGoalsRedirect() {
  permanentRedirect("/mentorship?view=me&section=goals");
}
