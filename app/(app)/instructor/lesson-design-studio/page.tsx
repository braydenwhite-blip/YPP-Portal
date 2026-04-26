import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getCurriculumDraftForStudio,
  listCurriculumDraftSummaries,
} from "@/lib/curriculum-draft-actions";
import { getCurriculumDraftProgress } from "@/lib/curriculum-draft-progress";
import {
  buildLessonDesignStudioHref,
  deriveStudioPhase,
  getCanonicalStudioHref,
  getStudioDraftIdFromSearchParams,
  getStudioEntryContextFromSearchParams,
} from "@/lib/lesson-design-studio";
import { getLessonDesignStudioGateStatus } from "@/lib/lesson-design-studio-gate";
import { DraftChooser } from "./draft-chooser";
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

  const gate = await getLessonDesignStudioGateStatus(session.user.id, roles);
  if (!gate.unlocked) {
    redirect("/instructor-training?locked=lesson-design-studio");
  }

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

  const draft = draftId ? await getCurriculumDraftForStudio(draftId) : null;

  if (!draftId || !draft) {
    const draftSummaries = await listCurriculumDraftSummaries();
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
  const derivedPhase = deriveStudioPhase({
    status: studioDraft.status,
    title: studioDraft.title,
    interestArea: studioDraft.interestArea,
    outcomes: studioDraft.outcomes,
    courseConfig: studioDraft.courseConfig,
    weeklyPlans: studioDraft.weeklyPlans,
    understandingChecks: studioDraft.understandingChecks,
    progress,
  });

  redirect(
    buildLessonDesignStudioHref({
      entryContext,
      draftId,
      notice,
      phase: derivedPhase,
    })
  );
}
