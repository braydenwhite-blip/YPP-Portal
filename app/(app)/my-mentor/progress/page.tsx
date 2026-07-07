import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Progress — My development" };

/** Folded into the self Mentorship workspace as the Reviews section. */
export default function LegacyMyMentorProgressRedirect() {
  permanentRedirect("/mentorship?view=me&section=reviews");
}
