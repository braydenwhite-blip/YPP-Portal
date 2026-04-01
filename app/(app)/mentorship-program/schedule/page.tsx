import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMentorScheduleManagerData } from "@/lib/mentorship-scheduling-actions";
import MentorSchedulePanel from "./mentor-schedule-panel";

export const metadata = { title: "Meeting Requests — Mentorship Program" };

export default async function MentorSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT") || roles.includes("ADMIN");
  if (!isMentor) redirect("/");

  const data = await getMentorScheduleManagerData();

  return <MentorSchedulePanel data={data} />;
}
