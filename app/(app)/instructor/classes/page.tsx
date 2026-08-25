import { notFound } from "next/navigation";

import { ClassAttendanceRoster } from "@/components/instructor/class-attendance-roster";
import { getClassAttendanceRoster } from "@/lib/session8/instructor-ops";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendance — YPP" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roster = await getClassAttendanceRoster(id);
  if (!roster) notFound();
  return <ClassAttendanceRoster roster={roster} />;
}