import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Submit Reflection" };

// Canonical mentee home is /mentorship?view=me; the monthly reflection now
// lives in its Reflection section.
export default function LegacyMyProgramReflectPage() {
  permanentRedirect("/mentorship?view=me&section=reflection");
}
