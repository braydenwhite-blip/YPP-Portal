import { notFound } from "next/navigation";

import {
  ClassPeopleRoster,
  type ClassPeopleRow,
} from "@/components/instructor/class-people-roster";
import {
  loadStudentClassHistories,
  loadStudentFamilies,
  personRoleLabel,
} from "@/lib/classes/student-class-history";
import { getInstructorClass } from "@/lib/session8/instructor-ops";

export const dynamic = "force-dynamic";
export const metadata = { title: "People — YPP" };

type EnrollmentRow = {
  id: string;
  status: string;
  studentId: string;
  student?: {
    id: string;
    name?: string | null;
    email?: string | null;
    primaryRole?: string | null;
  } | null;
};

export default async function InstructorClassRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getInstructorClass(id);
  if (!c) notFound();

  const enrollments = ((c as { enrollments?: EnrollmentRow[] }).enrollments ??
    []) as EnrollmentRow[];

  // People page is only "in class" or "was in this class" — waitlist seats stay
  // in enrollment ops, not on this roster.
  const visible = enrollments.filter((e) =>
    ["ENROLLED", "DROPPED", "COMPLETED"].includes(e.status),
  );
  const studentIds = [...new Set(visible.map((e) => e.studentId))];
  const [histories, families] = await Promise.all([
    loadStudentClassHistories(studentIds),
    loadStudentFamilies(studentIds),
  ]);

  const rows: ClassPeopleRow[] = visible.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    status: row.status,
    name: row.student?.name?.trim() || "Student",
    email: row.student?.email ?? null,
    roleLabel: personRoleLabel(row.student?.primaryRole),
    classes: histories.get(row.studentId) ?? [],
    family: families.get(row.studentId) ?? [],
  }));

  return (
    <ClassPeopleRoster classId={id} classTitle={c.title} rows={rows} />
  );
}
