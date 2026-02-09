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
  const slotId = formData.get("slotId") as string;

  // Verify the slot belongs to the instructor
  const slot = await prisma.officeHourSlot.findUnique({
    where: { id: slotId }
  });

  if (!slot || slot.instructorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.officeHourSlot.delete({
    where: { id: slotId }
  });

  redirect("/instructor/office-hours/manage");
}
