import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Action editing now lives inside the Action Tracker at /actions/[id]/edit
// (Phase 3). This legacy admin route redirects so old links keep working.
export default async function LegacyEditActionRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/actions/${id}/edit`);
}
