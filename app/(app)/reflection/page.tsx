import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Monthly Reflection — YPP" };

// Legacy monthly self-reflection (deprecated ReflectionForm models). The
// canonical self-input for the mentorship review loop is /my-mentor/reflection.
export default function LegacyReflectionPage() {
  permanentRedirect("/my-mentor/reflection");
}
