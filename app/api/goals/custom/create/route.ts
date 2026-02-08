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
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string | null;
    const targetDateStr = formData.get("targetDate") as string | null;
    const milestonesStr = formData.get("milestones") as string | null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const targetDate = targetDateStr ? new Date(targetDateStr) : null;

    // Parse milestones
    const milestones = milestonesStr
      ? milestonesStr.split(",").map(m => m.trim()).filter(m => m.length > 0)
      : [];

    // Create the goal
    const goal = await prisma.customGoal.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        targetDate,
        milestones: {
          create: milestones.map((milestone, index) => ({
            title: milestone,
            sortOrder: index
          }))
        }
      }
    });

    return NextResponse.redirect(new URL(`/goals/custom/${goal.id}`, request.url));
  } catch (error) {
    console.error("Error creating custom goal:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
