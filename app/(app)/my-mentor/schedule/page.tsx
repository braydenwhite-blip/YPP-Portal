import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Schedule — My development" };

/** Folded into the self Mentorship workspace as the Schedule section. */
export default function LegacyMyMentorScheduleRedirect() {
  permanentRedirect("/mentorship?view=me&section=schedule");
}
