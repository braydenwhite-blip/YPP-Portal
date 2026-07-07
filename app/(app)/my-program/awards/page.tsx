import { permanentRedirect } from "next/navigation";

export const metadata = { title: "My Awards" };

// Canonical mentee home is /mentorship?view=me; recognition & awards now live
// in its Recognition section.
export default function LegacyMyProgramAwardsPage() {
  permanentRedirect("/mentorship?view=me&section=recognition");
}
