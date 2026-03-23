import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getInterviewScheduleData } from "@/lib/interview-scheduling-actions";
import InterviewScheduleClient from "./interview-schedule-client";

export const metadata = { title: "Interview Scheduling — YPP" };

export default async function InterviewSchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const data = await getInterviewScheduleData();

  return <InterviewScheduleClient data={data} />;
}
