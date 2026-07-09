import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";

export const metadata = { title: "Resources — My development" };

/** Your own Review & G&R flow now lives on /people/[id] (your own id). */
export default async function LegacyMyMentorResourcesRedirect() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/my-mentor/resources");
  redirect(`/people/${viewer.id}?section=review`);
}
