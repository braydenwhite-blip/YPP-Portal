"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function parseCSV(text: string): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));

  return { headers, rows };
}

export async function importApplicationsFromCSV(formData: FormData): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session || !roles.includes("ADMIN")) {
    throw new Error("Unauthorized: Admin access required");
  }

  const csvDataRaw = formData.get("csvData") as string;
  const roleType = formData.get("roleType") as string;
  const cohortId = formData.get("cohortId") as string | null;
  const fieldMappingRaw = formData.get("fieldMapping") as string;

  const rows: string[][] = JSON.parse(csvDataRaw);
  const fieldMapping: Record<string, number> = JSON.parse(fieldMappingRaw);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name =
        fieldMapping.name !== undefined ? row[fieldMapping.name] : undefined;
      const email =
        fieldMapping.email !== undefined ? row[fieldMapping.email] : undefined;

      if (!email) {
        skipped++;
        errors.push(`Row ${i + 1}: Missing email`);
        continue;
      }

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: name || email.split("@")[0],
            email,
            passwordHash: "IMPORTED",
            primaryRole: "APPLICANT",
          },
        });
      }

      if (roleType === "INSTRUCTOR") {
        const motivation =
          fieldMapping.motivation !== undefined
            ? row[fieldMapping.motivation]
            : "";
        const teachingExperience =
          fieldMapping.teachingExperience !== undefined
            ? row[fieldMapping.teachingExperience]
            : "";
        const availability =
          fieldMapping.availability !== undefined
            ? row[fieldMapping.availability]
            : "";

        await prisma.instructorApplication.create({
          data: {
            applicantId: user.id,
            motivation: motivation || "",
            teachingExperience: teachingExperience || "",
            availability: availability || "",
            ...(cohortId ? { cohortId } : {}),
          },
        });
      } else {
        const leadershipExperience =
          fieldMapping.leadershipExperience !== undefined
            ? row[fieldMapping.leadershipExperience]
            : "";
        const chapterVision =
          fieldMapping.chapterVision !== undefined
            ? row[fieldMapping.chapterVision]
            : "";
        const availability =
          fieldMapping.availability !== undefined
            ? row[fieldMapping.availability]
            : "";

        await prisma.chapterPresidentApplication.create({
          data: {
            applicantId: user.id,
            leadershipExperience: leadershipExperience || "",
            chapterVision: chapterVision || "",
            availability: availability || "",
            ...(cohortId ? { cohortId } : {}),
          },
        });
      }

      imported++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Row ${i + 1}: ${message}`);
      skipped++;
    }
  }

  revalidatePath("/admin/application-cohorts");
  revalidatePath("/admin/import-applications");

  return { imported, skipped, errors };
}
