import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import { resolveStartingPosition } from "@/lib/growth-pathway";
import { GrowthDashboard } from "@/components/leadership-pathway/growth-dashboard";

export const metadata = {
  title: "Growth Pathway — YPP",
  description:
    "Your YPP growth pathway — role, next promotion step, expectations, progress, evidence, and what to do next.",
};

export default async function LeadershipPathwayPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");

  const { trackId, roleId } = resolveStartingPosition({
    stageId: ctx?.stageId ?? null,
    primaryRole: ctx?.user.primaryRole ?? session.user.primaryRole ?? null,
  });

  return (
    <GrowthDashboard
      userId={session.user.id}
      userName={session.user.name ?? "there"}
      isAdmin={isAdmin}
      initialTrackId={trackId}
      initialRoleId={roleId}
    />
  );
}
