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
    const groupId = formData.get("groupId") as string;

    if (!groupId) {
      return NextResponse.json({ error: "Missing group ID" }, { status: 400 });
    }

    // Get the membership
    const membership = await prisma.studyGroupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id
      },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!membership) {
      return NextResponse.redirect(new URL("/study-groups", request.url));
    }

    // If creator is leaving and there are other members, promote someone to creator
    if (membership.role === "CREATOR" && membership.group.members.length > 1) {
      const nextMember = membership.group.members.find(m => m.userId !== session.user.id);
      if (nextMember) {
        await prisma.studyGroupMember.update({
          where: { id: nextMember.id },
          data: { role: "CREATOR" }
        });
      }
    }

    // Remove the member
    await prisma.studyGroupMember.delete({
      where: { id: membership.id }
    });

    // If no members left, deactivate the group
    if (membership.group.members.length === 1) {
      await prisma.studyGroup.update({
        where: { id: groupId },
        data: { isActive: false }
      });
    }

    return NextResponse.redirect(new URL("/study-groups", request.url));
  } catch (error) {
    console.error("Error leaving study group:", error);
    return NextResponse.json({ error: "Failed to leave study group" }, { status: 500 });
  }
}
