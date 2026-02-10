import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CreateAssignmentClient } from "./client";

export default async function CreateClassAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: offeringId } = await params;

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      template: { select: { title: true, interestArea: true } },
      sessions: { orderBy: { sessionNumber: "asc" }, select: { id: true, sessionNumber: true, topic: true } },
    },
  });

  if (!offering) redirect("/classes/catalog");

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/classes/${offeringId}/assignments`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Assignments
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Create Assignment</h1>
        </div>
      </div>

      {/* Philosophy reminder */}
      <div className="card" style={{ marginBottom: 24, background: "#f0fdf4", borderLeft: "4px solid #16a34a" }}>
        <div style={{ fontWeight: 600, color: "#16a34a" }}>Enjoyment-Focused Design</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Remember: Focus on exploration over perfection. Use narrative feedback instead of grades.
          Encourage experimentation and celebrate effort!
        </p>
      </div>

      <CreateAssignmentClient
        offeringId={offeringId}
        sessions={offering.sessions}
      />
    </div>
  );
}
