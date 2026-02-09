import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const noteId = formData.get("noteId") as string;
    const courseId = formData.get("courseId") as string | null;
    const lessonTitle = formData.get("lessonTitle") as string | null;
    const content = formData.get("content") as string;
    const tagsString = formData.get("tags") as string | null;
    const isPinned = formData.get("isPinned") === "true";

    if (!noteId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const note = await prisma.learningNote.findUnique({
      where: { id: noteId }
    });

    if (!note || note.userId !== session.user.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Parse tags
    const tags = tagsString
      ? tagsString.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    // Update the note
    await prisma.learningNote.update({
      where: { id: noteId },
      data: {
        courseId: courseId || null,
        lessonTitle: lessonTitle || null,
        content: content.trim(),
        tags,
        isPinned
      }
    });

    return NextResponse.redirect(new URL(`/notes/${noteId}`, request.url));
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}
