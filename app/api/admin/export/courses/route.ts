import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courses = await prisma.course.findMany({
    include: {
      leadInstructor: true,
      _count: {
        select: { enrollments: true }
      }
    },
    orderBy: { startDate: 'desc' }
  });

  const csv = [
    "Course Title,Code,Instructor,Enrollments,Start Date,End Date",
    ...courses.map(course =>
      `"${course.title}","${course.code}","${course.leadInstructor.name}",${course._count.enrollments},"${new Date(course.startDate).toISOString().split('T')[0]}","${new Date(course.endDate).toISOString().split('T')[0]}"`
    )
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="courses-export-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}
