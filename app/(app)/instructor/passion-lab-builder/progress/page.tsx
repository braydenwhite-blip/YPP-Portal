import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getLabProgress } from "@/lib/passion-lab-actions";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";
import { PassionLabProgressClient } from "./client";

type Props = {
  searchParams: { programId?: string };
};

export default async function PassionLabProgressPage({ searchParams }: Props) {
  const session = await getSession();
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
      <div style={{ display: "grid", gap: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Student Progress
        </h1>
        <div
          className="card"
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            padding: 16,
          }}
        >
          Passion Lab progress is waiting on the latest database migration for this deployment.
        </div>
      </div>
    );
  }

  const programId = searchParams.programId;
  if (!programId) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Student Progress
        </h1>
        <div
          className="card"
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            padding: 16,
          }}
        >
          No Passion Lab selected. Please go back to the Passion Lab Builder and
          select a lab to view progress.
        </div>
      </div>
    );
  }

  const program = await prisma.specialProgram.findUnique({
    where: { id: programId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      sessions: { orderBy: { scheduledAt: "asc" } },
    },
  });

  if (!program) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Student Progress
        </h1>
        <div
          className="card"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: 16,
          }}
        >
          Passion Lab not found.
        </div>
      </div>
    );
  }

  if (
    program.createdById !== session.user.id &&
    !roles.includes("ADMIN")
  ) {
    redirect("/dashboard");
  }

  const progressRecords = await getLabProgress(programId);

  const sessionTopics = Array.isArray(program.sessionTopics)
    ? (program.sessionTopics as Array<{ topic?: string; activities?: string; materials?: string }>)
    : [];

  const students = program.participants.map((p) => ({
    id: p.user.id,
    name: p.user.name ?? "Unknown",
    email: p.user.email ?? "",
  }));

  return (
    <PassionLabProgressClient
      programId={program.id}
      programName={program.name}
      sessionTopics={sessionTopics}
      students={students}
      progressRecords={progressRecords}
    />
  );
}
