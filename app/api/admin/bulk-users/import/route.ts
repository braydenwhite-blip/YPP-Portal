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
  const file = formData.get("csvFile") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);

  // Skip header if present
  const dataLines = lines[0].toLowerCase().includes("name") ? lines.slice(1) : lines;

  let imported = 0;
  let errors: string[] = [];

  for (const line of dataLines) {
    const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ''));
    
    if (parts.length < 3) {
      errors.push(`Invalid line: ${line}`);
      continue;
    }

    const [name, email, role] = parts;

    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email }
      });

      if (existing) {
        errors.push(`User already exists: ${email}`);
        continue;
      }

      // Create user
      await prisma.user.create({
        data: {
          name,
          email,
          primaryRole: role as any
        }
      });

      imported++;
    } catch (error) {
      errors.push(`Error creating user ${email}: ${error}`);
    }
  }

  redirect(`/admin/bulk-users?imported=${imported}&errors=${errors.length}`);
}
