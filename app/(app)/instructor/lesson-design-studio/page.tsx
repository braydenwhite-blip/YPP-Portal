import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurriculumDraft } from "@/lib/curriculum-draft-actions";
import { StudioClient } from "./studio-client";
import "./studio.css";

export default async function CurriculumBuilderStudioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("APPLICANT");

  if (!hasAccess) redirect("/");

  const draft = await getOrCreateCurriculumDraft();

  return (
    <StudioClient
      userId={session.user.id}
      userName={session.user.name ?? "Instructor"}
      draft={{
        id: draft.id,
        title: draft.title,
        description: draft.description ?? "",
        interestArea: draft.interestArea,
        outcomes: draft.outcomes,
        weeklyPlans: (draft.weeklyPlans as unknown[]) ?? [],
        status: draft.status,
        updatedAt: draft.updatedAt.toISOString(),
      }}
    />
  );
}
