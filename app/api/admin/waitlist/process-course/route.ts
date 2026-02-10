import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { processWaitlist } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const courseIdRaw = formData.get("courseId");
  if (typeof courseIdRaw !== "string" || !courseIdRaw) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }
  const courseId = courseIdRaw;

  const offered = await processWaitlist(courseId);
  const processed = offered ? 1 : 0;

  redirect("/admin/waitlist?processed=" + processed);
}
