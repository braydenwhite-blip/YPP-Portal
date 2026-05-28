import { permanentRedirect } from "next/navigation";

export const metadata = { title: "G&R Templates — Admin" };

// Canonical admin G&R home is /admin/mentorship/gr; templates now live at
// /admin/mentorship/gr/templates.
export default function LegacyGRTemplatesPage() {
  permanentRedirect("/admin/mentorship/gr/templates");
}
