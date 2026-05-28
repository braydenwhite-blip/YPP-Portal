import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Submit Reflection" };

// Canonical mentee home is /my-mentor; the monthly reflection now lives at /my-mentor/reflection.
export default function LegacyMyProgramReflectPage() {
  permanentRedirect("/my-mentor/reflection");
}
