import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import {
  listAllParentFeedback,
  listChapterParentFeedback,
  listInstructorScopedParentFeedback,
  summarizeParentFeedback,
} from "@/lib/parent-feedback-service";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canAccess =
    roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT");

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chapterId = session.user.chapterId ?? null;
  const feedback = roles.includes("ADMIN")
    ? await listAllParentFeedback()
    : roles.includes("CHAPTER_PRESIDENT") && chapterId
      ? await listChapterParentFeedback(chapterId)
      : await listInstructorScopedParentFeedback(session.user.id);

  return NextResponse.json({
    feedback,
    summary: summarizeParentFeedback(feedback),
  });
}
