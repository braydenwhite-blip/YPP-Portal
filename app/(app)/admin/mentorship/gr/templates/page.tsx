import { redirect } from "next/navigation";

/** Folded into the cockpit's Goals tab. See app/(app)/admin/mentorship/gr/page.tsx. */
export default function AdminGRTemplatesPage() {
  redirect("/mentorship?view=admin&tab=templates");
}
