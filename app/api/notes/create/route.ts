import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const courseId = formData.get("courseId") as string | null;
    const lessonTitle = formData.get("lessonTitle") as string | null;
    const content = formData.get("content") as string;
    const tagsString = formData.get("tags") as string | null;
    const isPinned = formData.get("isPinned") === "true";

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Parse tags
    const tags = tagsString
      ? tagsString.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    // Create the note
    const note = await prisma.learningNote.create({
      data: {
        userId: session.user.id,
        courseId: courseId || null,
        lessonTitle: lessonTitle || null,
        content: content.trim(),
        tags,
        isPinned
      }
    });

    return NextResponse.redirect(new URL(`/notes/${note.id}`, request.url));
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
