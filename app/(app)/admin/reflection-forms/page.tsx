import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Reflection Forms — YPP Admin" };

// The legacy reflection form builder is retired: self-input for the review
// loop is structured (MonthlySelfReflection), not form-built. Past
// submissions remain readable in the archive.
export default function LegacyReflectionFormsPage() {
  permanentRedirect("/admin/reflections");
}
