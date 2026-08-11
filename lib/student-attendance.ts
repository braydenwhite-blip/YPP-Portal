import { prisma } from "@/lib/prisma";

export type StudentAttendanceRecord = {
  id: string;
  offeringId: string;
  offeringTitle: string;
  sessionDate: Date;
  sessionTopic: string;
  sessionNumber: number;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  notes: string | null;
};

export type StudentAttendanceSummary = {
  records: StudentAttendanceRecord[];
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
};

/**
 * Attendance an instructor has finalized for this student. Records still in
 * draft (`finalizedAt` null) are not shown — students only see attendance
 * once an instructor has finalized it for a session.
 */
export async function getMyAttendance(studentId: string): Promise<StudentAttendanceSummary> {
  const records = await prisma.classAttendanceRecord.findMany({
    where: {
      studentId,
      finalizedAt: { not: null },
    },
    include: {
      session: {
        select: {
          date: true,
          topic: true,
          sessionNumber: true,
          offering: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { session: { date: "desc" } },
  });

  const mapped: StudentAttendanceRecord[] = records.map((record) => ({
    id: record.id,
    offeringId: record.session.offering.id,
    offeringTitle: record.session.offering.title,
    sessionDate: record.session.date,
    sessionTopic: record.session.topic,
    sessionNumber: record.session.sessionNumber,
    status: record.status,
    notes: record.notes,
  }));

  return {
    records: mapped,
    presentCount: mapped.filter((record) => record.status === "PRESENT").length,
    absentCount: mapped.filter((record) => record.status === "ABSENT").length,
    lateCount: mapped.filter((record) => record.status === "LATE").length,
    excusedCount: mapped.filter((record) => record.status === "EXCUSED").length,
  };
}