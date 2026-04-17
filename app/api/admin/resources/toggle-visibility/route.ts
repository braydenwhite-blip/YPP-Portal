import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
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
