import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  deleteFeatureGateRule,
  getEnabledFeatureKeysForUser,
  setUserFeatureGateRule,
} from "@/lib/feature-gates";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  const users = query
    ? await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
          roles: { select: { role: true } },
        },
        take: 20,
        orderBy: { name: "asc" },
      })
    : [];

  const payload = await Promise.all(
    users.map(async (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      primaryRole: user.primaryRole,
      chapterName: user.chapter?.name ?? null,
      enabledFeatureKeys: await getEnabledFeatureKeysForUser({
        userId: user.id,
        chapterId: user.chapterId,
        roles: user.roles.map((role) => role.role),
        primaryRole: user.primaryRole,
      }),
    }))
  );

  return NextResponse.json({ users: payload });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") || "set");

  if (action === "delete") {
    await deleteFeatureGateRule(formData);
    return NextResponse.json({ ok: true, action: "delete" });
  }

  await setUserFeatureGateRule(formData);
  return NextResponse.json({ ok: true, action: "set" });
}
