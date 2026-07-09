import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";

export const metadata = { title: "Schedule — My development" };

/** Your own Review & G&R flow now lives on /people/[id] (your own id). */
export default async function LegacyMyMentorScheduleRedirect() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/my-mentor/schedule");
  redirect(`/people/${viewer.id}?section=check-ins`);
}
