import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Resources — My development" };

/** Folded into the self Mentorship workspace's Recognition/Resources section. */
export default function LegacyMyMentorResourcesRedirect() {
  permanentRedirect("/mentorship?view=me&section=recognition");
}
