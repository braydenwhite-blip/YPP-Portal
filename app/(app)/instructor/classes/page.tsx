import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";
import { InstructorClassesList } from "@/components/instructor/instructor-classes-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Classes — Pathways Portal" };

const COCKPIT_ROLES = ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"];

// The canonical list of accepted teaching responsibilities. Every class is
// shown once; the richer session workflow lives at /instructor/classes/[id].
export default async function InstructorClassesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((r) => COCKPIT_ROLES.includes(r))) redirect("/");

  const workspace = await loadInstructorTeachingWorkspace(session.user.id);
  return <InstructorClassesList workspace={workspace} />;
}
