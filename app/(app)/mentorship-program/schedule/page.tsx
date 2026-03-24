import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMentorScheduleQueue } from "@/lib/mentorship-scheduling-actions";
import MentorSchedulePanel from "./mentor-schedule-panel";

export const metadata = { title: "Meeting Requests — Mentorship Program" };

export default async function MentorSchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT") || roles.includes("ADMIN");
  if (!isMentor) redirect("/");

  const requests = await getMentorScheduleQueue();

  return <MentorSchedulePanel requests={requests} />;
}
