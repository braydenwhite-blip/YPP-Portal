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

  if (session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const emailsText = formData.get("emails") as string;
  const newRole = formData.get("newRole") as string;

  // Parse emails (one per line)
  const emails = emailsText
    .split("\n")
    .map(email => email.trim())
    .filter(email => email.length > 0);

  // Update users
  const result = await prisma.user.updateMany({
    where: {
      email: {
        in: emails
      }
    },
    data: {
      primaryRole: newRole as any
    }
  });

  redirect("/admin/bulk-users?updated=" + result.count);
}
