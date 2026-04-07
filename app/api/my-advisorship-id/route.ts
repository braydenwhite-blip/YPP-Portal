import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ advisorshipId: null }, { status: 401 });
  }

  const advisorship = await prisma.collegeAdvisorship.findFirst({
    where: { adviseeId: session.user.id, endDate: null },
    select: { id: true },
  });

  return NextResponse.json({ advisorshipId: advisorship?.id ?? null });
}
