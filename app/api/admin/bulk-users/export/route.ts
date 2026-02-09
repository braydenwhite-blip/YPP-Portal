import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const format = formData.get("format") as string;

  // Build query based on format
  const where = format === "students" ? { primaryRole: "STUDENT" as const } :
                format === "instructors" ? { primaryRole: "INSTRUCTOR" as const } :
                {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  // Generate CSV
  const csv = [
    "Name,Email,Role,Created At",
    ...users.map(user =>
      `"${user.name}","${user.email}","${user.primaryRole}","${new Date(user.createdAt).toISOString()}"`
    )
  ].join("\n");

  // Return as downloadable CSV
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="users-${format}-${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
}
