import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import ScheduleClient from "../../my-program/schedule/schedule-client";

export const metadata = { title: "Mentor Schedule — YPP Mentorship" };

// Canonical mentorship schedule route. Old paths (/mentorship/calendar,
// /mentorship-program/schedule) redirect here. /my-program/schedule still
// renders the same UI for now to avoid breaking external bookmarks.
export default async function MentorshipSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return <ScheduleClient data={data} />;
}
