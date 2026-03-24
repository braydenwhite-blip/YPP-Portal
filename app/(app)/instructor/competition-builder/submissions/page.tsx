import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCompetitionSubmissions } from "@/lib/competition-draft-actions";
import { SubmissionsClient } from "./client";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ competitionId?: string }>;
}) {
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

  const params = await searchParams;
  const competitionId = params.competitionId;

  if (!competitionId) {
    return (
      <div style={{ padding: 24, maxWidth: 860 }}>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          Submission Management
        </h1>
        <div
          className="card"
          style={{
            padding: "24px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          No competition selected. Please open this page from a competition
          builder draft with a valid competition ID.
        </div>
      </div>
    );
  }

  const submissions = await getCompetitionSubmissions(competitionId);

  return (
    <SubmissionsClient
      competitionId={competitionId}
      initialSubmissions={submissions}
    />
  );
}
