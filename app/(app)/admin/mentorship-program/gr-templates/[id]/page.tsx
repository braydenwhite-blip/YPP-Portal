import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Edit G&R Template — Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

// Canonical admin G&R template editor now lives at
// /admin/mentorship/gr/templates/[id].
export default async function LegacyGRTemplateDetailPage({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/admin/mentorship/gr/templates/${id}`);
}
