import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInterviewScheduleData } from "@/lib/interview-scheduling-actions";
import InterviewScheduleClient from "./interview-schedule-client";

export const metadata = { title: "Interview Scheduling — YPP" };

export default async function InterviewSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getInterviewScheduleData();

  return <InterviewScheduleClient data={data} />;
}
