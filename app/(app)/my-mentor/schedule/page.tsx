import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import { ScheduleSurface } from "@/app/(app)/mentorship/schedule/schedule-surface";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Schedule — My Mentor" };

export default async function MyMentorSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return (
    <div>
      <MyMentorSubnav />
      <ScheduleSurface data={data} reviewHref="/my-mentor/reflection" />
    </div>
  );
}
