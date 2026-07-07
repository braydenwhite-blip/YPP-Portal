import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Awards — My development" };

/** Folded into the self Mentorship workspace's Recognition section. */
export default function LegacyMyMentorAwardsRedirect() {
  permanentRedirect("/mentorship?view=me&section=recognition");
}
