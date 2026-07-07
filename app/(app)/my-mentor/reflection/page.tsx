import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Reflection — My development" };

/** Folded into the self Mentorship workspace as the Reflection section. */
export default function LegacyMyMentorReflectionRedirect() {
  permanentRedirect("/mentorship?view=me&section=reflection");
}
