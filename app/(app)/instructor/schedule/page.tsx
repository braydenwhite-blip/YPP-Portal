import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";
import { InstructorScheduleView } from "@/components/instructor/instructor-schedule-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teaching schedule — YPP" };

export default async function InstructorSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((role) => ["INSTRUCTOR", "ADMIN", "CHAPTER_PRESIDENT"].includes(role))) redirect("/");

  const workspace = await loadInstructorTeachingWorkspace(session.user.id);
  return <InstructorScheduleView workspace={workspace} />;
}

