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

    if (!noteId) {
      return NextResponse.json({ error: "Missing note ID" }, { status: 400 });
    }

    // Verify ownership
    const note = await prisma.learningNote.findUnique({
      where: { id: noteId }
    });

    if (!note || note.userId !== session.user.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Delete the note
    await prisma.learningNote.delete({
      where: { id: noteId }
    });

    return NextResponse.redirect(new URL("/notes", request.url));
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
