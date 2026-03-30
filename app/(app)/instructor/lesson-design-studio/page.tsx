import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getCurriculumDraftForStudio,
  listCurriculumDraftSummaries,
} from "@/lib/curriculum-draft-actions";
import { getCurriculumDraftProgress } from "@/lib/curriculum-draft-progress";
import {
  deriveStudioPhase,
  getCanonicalStudioHref,
  getStudioDraftIdFromSearchParams,
  getStudioEntryContextFromSearchParams,
} from "@/lib/lesson-design-studio";
import { DraftChooser } from "./draft-chooser";
import { StudioClient } from "./studio-client";
import "./studio.css";

export default async function CurriculumBuilderStudioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("APPLICANT");

  if (!hasAccess) redirect("/");

  const params = (await searchParams) ?? {};
  const entryContext = getStudioEntryContextFromSearchParams(params);
  const draftId = getStudioDraftIdFromSearchParams(params);
  const noticeParam = params.notice;
  const notice =
    typeof noticeParam === "string"
      ? noticeParam
      : Array.isArray(noticeParam)
        ? noticeParam[0] ?? null
        : null;
  const canonicalHref = getCanonicalStudioHref(params);
  if (canonicalHref) {
    redirect(canonicalHref);
  }

  const [draftSummaries, draft] = await Promise.all([
    listCurriculumDraftSummaries(),
    draftId ? getCurriculumDraftForStudio(draftId) : Promise.resolve(null),
  ]);

  if (!draftId || !draft) {
    return (
      <DraftChooser
        userName={session.user.name ?? "Instructor"}
        entryContext={entryContext}
        drafts={draftSummaries}
        notice={draftId && !draft ? notice ?? "draft-not-found" : notice}
      />
    );
  }

  const progress = getCurriculumDraftProgress({
    title: draft.title,
    interestArea: draft.interestArea,
    outcomes: draft.outcomes,
    courseConfig: draft.courseConfig,
    weeklyPlans: draft.weeklyPlans,
    understandingChecks: draft.understandingChecks,
  });
  const currentPhase = deriveStudioPhase({
    status: draft.status,
    title: draft.title,
    interestArea: draft.interestArea,
    outcomes: draft.outcomes,
    courseConfig: draft.courseConfig,
    weeklyPlans: draft.weeklyPlans,
    understandingChecks: draft.understandingChecks,
    progress,
  });

  return (
    <StudioClient
      userId={session.user.id}
      userName={session.user.name ?? "Instructor"}
      entryContext={entryContext}
      notice={notice}
      currentPhase={currentPhase}
      progress={progress}
      draft={{
        id: draft.id,
        title: draft.title,
        description: draft.description ?? "",
        interestArea: draft.interestArea,
        outcomes: draft.outcomes,
        courseConfig: draft.courseConfig,
        weeklyPlans: Array.isArray(draft.weeklyPlans) ? draft.weeklyPlans : [],
        understandingChecks: draft.understandingChecks,
        reviewRubric: draft.reviewRubric,
        reviewNotes: draft.reviewNotes ?? "",
        reviewedAt: draft.reviewedAt?.toISOString() ?? null,
        submittedAt: draft.submittedAt?.toISOString() ?? null,
        approvedAt: draft.approvedAt?.toISOString() ?? null,
        generatedTemplateId: draft.generatedTemplateId ?? null,
        status: draft.status,
        updatedAt: draft.updatedAt.toISOString(),
      }}
    />
  );
}
