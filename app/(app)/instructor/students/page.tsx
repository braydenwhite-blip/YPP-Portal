import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";
import { InstructorStudentsView } from "@/components/instructor/instructor-students-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students — YPP" };

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((role) => ["INSTRUCTOR", "ADMIN", "CHAPTER_PRESIDENT"].includes(role))) {
    redirect("/");
  }

  const { class: classId } = await searchParams;
  const workspace = await loadInstructorTeachingWorkspace(session.user.id);

  const activeClasses = classId
    ? workspace.activeClasses.filter((item) => item.id === classId)
    : workspace.activeClasses;
  const completedClasses = classId
    ? workspace.completedClasses.filter((item) => item.id === classId)
    : workspace.completedClasses;
  const attentionItems = classId
    ? workspace.studentsNeedingAttention.filter((item) => item.classId === classId)
    : workspace.studentsNeedingAttention;

  return (
    <InstructorStudentsView
      activeClasses={activeClasses}
      completedClasses={completedClasses}
      attentionItems={attentionItems}
    />
  );
}
