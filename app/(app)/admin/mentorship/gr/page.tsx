import { redirect } from "next/navigation";

/**
 * The standalone G&R admin overview is now the cockpit's Goals tab — one
 * place for template, resource, and assignment management instead of two.
 * See app/(app)/admin/mentorship/_components/admin-cockpit.tsx (tab=templates).
 */
export default function AdminGROverviewPage() {
  redirect("/mentorship?view=admin&tab=templates");
}
