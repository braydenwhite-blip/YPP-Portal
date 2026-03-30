import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import ScheduleClient from "./schedule-client";

export const metadata = { title: "Schedule Meeting — YPP Mentorship" };

export default async function SchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return <ScheduleClient data={data} />;
}
