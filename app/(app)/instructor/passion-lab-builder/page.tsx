import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorPassionLabs, getActivePassionAreas } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { PassionLabBuilderClient } from "./client";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";

export default async function PassionLabBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_LEAD")
  ) {
    redirect("/dashboard");
  }
  const hasPassionLabSupport = await hasPassionLabBuilderSchema();

  const [passionLabs, passionAreas, instructor] = await Promise.all([
    hasPassionLabSupport ? getInstructorPassionLabs() : Promise.resolve([]),
    getActivePassionAreas(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { chapterId: true } }),
  ]);

  if (!hasPassionLabSupport) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Passion Lab Builder</h1>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Create a structured, passion-driven lab experience for students.
          </p>
        </div>

        <div
          className="card"
          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}
        >
          Passion Lab Builder is waiting on the latest passion lab database migration for this
          deployment. Once that migration is applied, this page will load your labs and let you
          create new ones again.
        </div>
      </div>
    );
  }

  return (
    <PassionLabBuilderClient
      existingLabs={passionLabs}
      passionAreas={passionAreas}
      chapterId={instructor?.chapterId ?? null}
    />
  );
}
