import { permanentRedirect } from "next/navigation";

export const metadata = { title: "My Goals & Resources" };

// Canonical mentee home is /mentorship?view=me; goals & resources now live in
// its Goals section.
export default function LegacyMyProgramGRPage() {
  permanentRedirect("/mentorship?view=me&section=goals");
}
