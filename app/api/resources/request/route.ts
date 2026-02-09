import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const passionId = formData.get("passionId") as string;
  const projectId = formData.get("projectId") as string;
  const itemName = formData.get("itemName") as string;
  const description = formData.get("description") as string;
  const reason = formData.get("reason") as string;
  const estimatedCost = formData.get("estimatedCost") as string;

  // Create resource request
  await prisma.resourceRequest.create({
    data: {
      studentId: session.user.id,
      passionId: passionId || null,
      projectId: projectId || null,
      itemName,
      description,
      reason,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      status: "PENDING"
    }
  });

  redirect("/projects/resources");
}
