import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const resourceId = formData.get("resourceId") as string;

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  });

  if (resource) {
    await prisma.resource.update({
      where: { id: resourceId },
      data: { isPublic: !resource.isPublic }
    });
  }

  redirect("/admin/resource-library");
}
