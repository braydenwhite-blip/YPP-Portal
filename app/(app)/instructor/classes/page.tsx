import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorCockpit } from "@/lib/classes/instructor-cockpit";
import { InstructorCockpitView } from "@/components/classes/instructor-cockpit-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Classes — Pathways Portal" };

const COCKPIT_ROLES = ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"];

// The Instructor Cockpit: every class this person teaches, what needs them
// today, and the one-tap workflows (attendance, reflection) — all driven by the
// real class runtime. Mobile-first and calm, not an admin dashboard.
export default async function InstructorClassesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((r) => COCKPIT_ROLES.includes(r))) redirect("/");

  const cockpit = await loadInstructorCockpit(session.user.id);
  return <InstructorCockpitView cockpit={cockpit} />;
}
