import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import ScheduleClient from "./schedule-client";

export const metadata = { title: "Schedule Meeting — YPP Mentorship" };

export default async function SchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return <ScheduleClient data={data} />;
}
