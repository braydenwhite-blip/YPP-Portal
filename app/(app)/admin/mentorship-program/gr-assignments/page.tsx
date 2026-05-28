import { permanentRedirect } from "next/navigation";

export const metadata = { title: "G&R Assignments — Admin" };

// Canonical admin G&R home is /admin/mentorship/gr; assignments now live at
// /admin/mentorship/gr/assignments.
export default function LegacyGRAssignmentsPage() {
  permanentRedirect("/admin/mentorship/gr/assignments");
}
