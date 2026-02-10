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
    orderBy: { createdAt: "desc" }
  });

  const csv = [
    "Course Title,Instructor,Enrollments,Max Enrollment,Format,Level,Interest Area,Virtual,Created At",
    ...courses.map(course =>
      `"${course.title}","${course.leadInstructor?.name ?? ""}",${course._count.enrollments},${course.maxEnrollment ?? ""},"${course.format}","${course.level ?? ""}","${course.interestArea}",${course.isVirtual},"${course.createdAt.toISOString()}"`
    )
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="courses-export-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}
