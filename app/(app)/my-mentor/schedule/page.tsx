import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import ScheduleClient from "@/app/(app)/my-program/schedule/schedule-client";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Schedule — My Mentorship" };

export default async function MyMentorSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return (
    <div>
      <MyMentorSubnav />
      <ScheduleClient data={data} />
    </div>
  );
}
