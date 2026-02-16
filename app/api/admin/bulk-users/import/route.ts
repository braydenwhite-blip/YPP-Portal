import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { RoleType } from "@prisma/client";

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^['"]|['"]$/g, ""));
}

function resolveRole(rawRole: string | undefined, preset: string | undefined): RoleType | null {
  const candidate = (rawRole || preset || "").trim().toUpperCase();
  if (!candidate) return null;
  if (candidate in RoleType) {
    return candidate as RoleType;
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("csvFile") as File | null;
  const defaultChapterId = String(formData.get("defaultChapterId") || "").trim();
  const rolePreset = String(formData.get("rolePreset") || "").trim();
  const dryRun = formData.get("dryRun") === "true";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    redirect("/admin/bulk-users?imported=0&failed=0&duplicates=0&invalid=0&error=Empty%20CSV");
  }

  const headerParts = splitCsvRow(lines[0]).map((part) => part.toLowerCase());
  const looksLikeHeader = headerParts.includes("email") || headerParts.includes("name");
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  const chapterByName = new Map(
    (
      await prisma.chapter.findMany({
        select: { id: true, name: true },
      })
    ).map((chapter) => [chapter.name.toLowerCase(), chapter.id])
  );

  let imported = 0;
  let failed = 0;
  let duplicates = 0;
  let invalid = 0;
  let firstError = "";

  for (let i = 0; i < dataLines.length; i++) {
    const rowIndex = i + 1;
    const parts = splitCsvRow(dataLines[i]);
    const [nameRaw, emailRaw, roleRaw, chapterRaw] = parts;

    const name = (nameRaw || "").trim();
    const email = (emailRaw || "").trim().toLowerCase();

    if (!name || !email || !email.includes("@")) {
      invalid++;
      if (!firstError) firstError = `Row ${rowIndex}: missing valid name/email`;
      continue;
    }

    const role = resolveRole(roleRaw, rolePreset);
    if (!role) {
      invalid++;
      if (!firstError) firstError = `Row ${rowIndex}: missing/invalid role`;
      continue;
    }

    let chapterId: string | null = null;
    if (chapterRaw && chapterRaw.trim()) {
      const rawChapter = chapterRaw.trim();
      chapterId = chapterByName.get(rawChapter.toLowerCase()) || null;
      if (!chapterId && rawChapter.startsWith("c")) {
        const existingChapter = await prisma.chapter.findUnique({ where: { id: rawChapter }, select: { id: true } });
        chapterId = existingChapter?.id || null;
      }
      if (!chapterId) {
        invalid++;
        if (!firstError) firstError = `Row ${rowIndex}: chapter not found (${rawChapter})`;
        continue;
      }
    } else if (defaultChapterId) {
      chapterId = defaultChapterId;
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      duplicates++;
      if (!firstError) firstError = `Row ${rowIndex}: user already exists (${email})`;
      continue;
    }

    if (dryRun) {
      imported++;
      continue;
    }

    try {
      const passwordHash = await hash(randomBytes(32).toString("hex"), 10);
      await prisma.user.create({
        data: {
          name,
          email,
          primaryRole: role,
          chapterId,
          passwordHash,
          roles: {
            create: [{ role }],
          },
        },
      });
      imported++;
    } catch (error) {
      failed++;
      if (!firstError) firstError = `Row ${rowIndex}: ${String(error)}`;
    }
  }

  redirect(
    `/admin/bulk-users?imported=${imported}&failed=${failed}&duplicates=${duplicates}&invalid=${invalid}&dryRun=${dryRun ? "true" : "false"}${firstError ? `&error=${encodeURIComponent(firstError)}` : ""}`
  );
}
