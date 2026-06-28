import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { loadInstructorClassDetail } from "@/lib/classes/instructor-cockpit";
import { InstructorClassDetailView } from "@/components/classes/instructor-class-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class — Pathways Portal" };

const COCKPIT_ROLES = ["ADMIN", "INSTRUCTOR", "CHAPTER_PRESIDENT"];

// One class's command surface for the instructor: identity, runtime, attendance
// roll-call, post-session reflection, roster signals, and feedback.
export default async function InstructorClassDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.some((r) => COCKPIT_ROLES.includes(r))) redirect("/");

  const detail = await loadInstructorClassDetail(session.user.id, params.id);
  if (!detail) redirect("/instructor/classes");

  return <InstructorClassDetailView detail={detail} />;
}
