import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";

export const metadata = { title: "Progress — My development" };

/** Your own Review & G&R flow now lives on /people/[id] (your own id). */
export default async function LegacyMyMentorProgressRedirect() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/my-mentor/progress");
  redirect(`/people/${viewer.id}?section=review`);
}
