import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";
import { PassionLabTemplatesClient } from "./client";

export default async function PassionLabTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_PRESIDENT")
  ) {
    redirect("/dashboard");
  }

  const hasSupport = await hasPassionLabBuilderSchema();
  if (!hasSupport) {
    return (
      <div style={{ padding: 24 }}>
        <h1 className="page-title">Passion Lab Templates</h1>
        <div className="card" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
          Template library requires the latest database migration.
        </div>
      </div>
    );
  }

  let templates: Array<{
    id: string;
    name: string;
    description: string | null;
    interestArea: string;
    difficulty: string | null;
    targetAgeGroup: string | null;
    templateCategory: string | null;
    sessionTopics: unknown;
  }> = [];

  try {
    templates = await prisma.specialProgram.findMany({
      where: { type: "PASSION_LAB", isTemplate: true },
      select: {
        id: true,
        name: true,
        description: true,
        interestArea: true,
        difficulty: true,
        targetAgeGroup: true,
        templateCategory: true,
        sessionTopics: true,
      },
      orderBy: { name: "asc" },
    });
  } catch {
    // isTemplate column may not exist yet
    templates = [];
  }

  return (
    <PassionLabTemplatesClient
      templates={JSON.parse(JSON.stringify(templates))}
    />
  );
}
