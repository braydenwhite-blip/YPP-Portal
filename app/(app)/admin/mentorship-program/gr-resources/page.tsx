import { permanentRedirect } from "next/navigation";

export const metadata = { title: "G&R Resources — Admin" };

// Canonical admin G&R home is /admin/mentorship/gr; the resource library now
// lives at /admin/mentorship/gr/resources.
export default function LegacyGRResourcesPage() {
  permanentRedirect("/admin/mentorship/gr/resources");
}
