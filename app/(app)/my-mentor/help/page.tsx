import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Get help — My development" };

/** Folded into the self Mentorship workspace's Overview section (help card). */
export default function LegacyMyMentorHelpRedirect() {
  permanentRedirect("/mentorship?view=me");
}
