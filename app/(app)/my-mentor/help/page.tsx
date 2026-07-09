import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";

export const metadata = { title: "Get help — My development" };

/** Your own Review & G&R flow now lives on /people/[id] (your own id). */
export default async function LegacyMyMentorHelpRedirect() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/my-mentor/help");
  redirect(`/people/${viewer.id}`);
}
