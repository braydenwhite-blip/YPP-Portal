import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorTeachingClass } from "@/lib/classes/instructor-workspace";
import { InstructorClassDetailView } from "@/components/classes/instructor-class-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class — Pathways Portal" };

const COCKPIT_ROLES = ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"];

// One class's command surface for the instructor: identity, runtime, attendance
// roll-call, post-session reflection, roster signals, and feedback.
export default async function InstructorClassDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await props.params;
  const search = await props.searchParams;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((r) => COCKPIT_ROLES.includes(r))) redirect("/");

  const detail = await loadInstructorTeachingClass(session.user.id, params.id);
  if (!detail) redirect("/instructor/classes");

  return <InstructorClassDetailView detail={detail} initialSessionId={search.session} />;
}
