import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      enrollments: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const csv = [
    "Name,Email,Role,Enrollments,Created At",
    ...users.map(user =>
      `"${user.name}","${user.email}","${user.primaryRole}",${user.enrollments.length},"${new Date(user.createdAt).toISOString()}"`
    )
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}
