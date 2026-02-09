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
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const amount = formData.get("amount") as string;
  const deadline = formData.get("deadline") as string;
  const requirements = formData.get("requirements") as string | null;
  const requireEssay = formData.get("requireEssay") === "true";

  await prisma.scholarship.create({
    data: {
      name,
      description,
      amount: parseFloat(amount),
      deadline: new Date(deadline),
      requirements: requirements || null,
      requireEssay
    }
  });

  redirect("/admin/scholarships");
}
