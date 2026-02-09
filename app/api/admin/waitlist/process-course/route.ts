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
  const courseId = formData.get("courseId") as string;

  const processed = await processWaitlist(courseId);

  redirect("/admin/waitlist?processed=" + processed);
}
