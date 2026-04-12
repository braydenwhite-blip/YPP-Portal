import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getCurriculumDraftForStudio,
  listCurriculumDraftSummaries,
} from "@/lib/curriculum-draft-actions";
import {
  getCurriculumDraftProgress,
  getWeeklyPlansInput,
} from "@/lib/curriculum-draft-progress";
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

  const studioDraft = draft.draft;

  const progress = getCurriculumDraftProgress({
    title: studioDraft.title,
    interestArea: studioDraft.interestArea,
    outcomes: studioDraft.outcomes,
    courseConfig: studioDraft.courseConfig,
    weeklyPlans: studioDraft.weeklyPlans,
    understandingChecks: studioDraft.understandingChecks,
  });
  const currentPhase = deriveStudioPhase({
    status: studioDraft.status,
    title: studioDraft.title,
    interestArea: studioDraft.interestArea,
    outcomes: studioDraft.outcomes,
    courseConfig: studioDraft.courseConfig,
    weeklyPlans: studioDraft.weeklyPlans,
    understandingChecks: studioDraft.understandingChecks,
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
      viewerAccess={draft.access}
      draft={{
        id: studioDraft.id,
        title: studioDraft.title,
        description: studioDraft.description ?? "",
        interestArea: studioDraft.interestArea,
        outcomes: studioDraft.outcomes,
        courseConfig: studioDraft.courseConfig,
        weeklyPlans: getWeeklyPlansInput(studioDraft.weeklyPlans),
        understandingChecks: studioDraft.understandingChecks,
        reviewRubric: studioDraft.reviewRubric,
        reviewNotes: studioDraft.reviewNotes ?? "",
        reviewedAt: studioDraft.reviewedAt?.toISOString() ?? null,
        submittedAt: studioDraft.submittedAt?.toISOString() ?? null,
        approvedAt: studioDraft.approvedAt?.toISOString() ?? null,
        generatedTemplateId: studioDraft.generatedTemplateId ?? null,
        status: studioDraft.status,
        updatedAt: studioDraft.updatedAt.toISOString(),
      }}
    />
  );
}
