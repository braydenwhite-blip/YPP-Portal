import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Schedule Meeting — YPP Mentorship" };

// Canonical mentee home is /mentorship?view=me; scheduling now lives in its
// Schedule section.
export default function LegacyMyProgramSchedulePage() {
  permanentRedirect("/mentorship?view=me&section=schedule");
}
