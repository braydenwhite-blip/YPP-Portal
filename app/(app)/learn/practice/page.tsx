import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyPracticeLogs, getMyPracticeStats } from "@/lib/practice-actions";
import PracticeLogClient from "./client";

export default async function PracticeLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [logs, stats] = await Promise.all([
    getMyPracticeLogs(20),
    getMyPracticeStats(),
  ]);

  // Serialise dates for client component
  const serialisedLogs = logs.map((log) => ({
    id: log.id,
    passionId: log.passionId,
    activity: log.activity,
    duration: log.duration,
    mood: log.mood,
    notes: log.notes,
    date: log.date.toISOString(),
  }));

  return <PracticeLogClient initialLogs={serialisedLogs} stats={stats} />;
}
