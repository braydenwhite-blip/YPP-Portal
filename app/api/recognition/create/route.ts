import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const toUserId = formData.get("toUserId") as string;
    const message = formData.get("message") as string;
    const isPublic = formData.get("isPublic") === "true";

    if (!toUserId || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create the recognition
    const recognition = await prisma.peerRecognition.create({
      data: {
        fromUserId: session.user.id,
        toUserId,
        message: message.trim(),
        isPublic
      }
    });

    // Send notification to recipient
    await createNotification({
      userId: toUserId,
      type: "SYSTEM",
      title: "You received recognition!",
      body: `${session.user.name} recognized you: "${message.slice(0, 100)}..."`,
      link: "/community/feed"
    });

    return NextResponse.redirect(new URL("/community/feed", request.url));
  } catch (error) {
    console.error("Error creating recognition:", error);
    return NextResponse.json({ error: "Failed to create recognition" }, { status: 500 });
  }
}
