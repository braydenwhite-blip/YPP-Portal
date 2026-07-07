import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Reflection History — YPP" };

// Legacy reflection history (deprecated ReflectionForm models). Past and
// current self-input lives on the canonical mentorship reflection surface.
export default function LegacyReflectionHistoryPage() {
  permanentRedirect("/mentorship?view=me&section=reflection");
}
