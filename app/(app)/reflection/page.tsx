import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Monthly Reflection — YPP" };

// Legacy monthly self-reflection (deprecated ReflectionForm models). The
// canonical self-input for the mentorship review loop is the Reflection
// section of /mentorship?view=me.
export default function LegacyReflectionPage() {
  permanentRedirect("/mentorship?view=me&section=reflection");
}
