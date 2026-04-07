import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const studentId = formData.get("studentId") as string;
  const term = formData.get("term") as string;
  const reason = formData.get("reason") as string;

  await prisma.studentSpotlight.create({
    data: {
      studentId,
      nominatedById: session.user.id,
      term,
      reason
    }
  });

  redirect("/instructor/student-spotlight");
}
