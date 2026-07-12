import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { canAccessPeopleHub, getPeopleHubAccess } from "@/lib/people/hub-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "People — Pathways Portal" };

/**
 * People landing — leadership performance roster now lives at
 * `/mentorship?view=people`. Officer-tier users without the performance table
 * still get the directory.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!canAccessPeopleHub(viewer)) {
    redirect("/");
  }

  const hubAccess = getPeopleHubAccess(viewer);
  if (!hubAccess.showPerformance) {
    redirect("/people/directory");
  }

  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("view", "people");
  for (const [key, raw] of Object.entries(sp)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) continue;
    if (key === "view") {
      // Old People urgency filters used `view=`; map them to `roster=`.
      params.set("roster", value);
      continue;
    }
    if (
      key === "roster" ||
      key === "q" ||
      key === "page" ||
      key === "mentor" ||
      key === "chair" ||
      key === "feedback" ||
      key === "performance" ||
      key === "potential"
    ) {
      params.set(key, value);
    }
  }
  redirect(`/mentorship?${params.toString()}`);
}
