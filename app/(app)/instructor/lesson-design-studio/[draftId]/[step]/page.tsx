import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getCurriculumDraftForStudio } from "@/lib/curriculum-draft-actions";
import {
  getCurriculumDraftProgress,
  getWeeklyPlansInput,
} from "@/lib/curriculum-draft-progress";
import {
  buildLessonDesignStudioHref,
  deriveStudioPhase,
  getCanonicalStudioHref,
  getStudioEntryContextFromSearchParams,
  studioStepSlugToPhase,
} from "@/lib/lesson-design-studio";
import { getLessonDesignStudioGateStatus } from "@/lib/lesson-design-studio-gate";
import { StudioClient } from "../../studio-client";
import "../../studio.css";

export default async function LessonDesignStudioDraftStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string; step: string }>;
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

  const { draftId, step } = await params;
  const sp = (await searchParams) ?? {};
  const entryContext = getStudioEntryContextFromSearchParams(sp);
  const noticeParam = sp.notice;
  const notice =
    typeof noticeParam === "string"
      ? noticeParam
      : Array.isArray(noticeParam)
        ? noticeParam[0] ?? null
        : null;

  const canonicalHref = getCanonicalStudioHref(sp);
  if (canonicalHref) {
    redirect(canonicalHref);
  }

  const draft = await getCurriculumDraftForStudio(draftId);
  if (!draft) {
    redirect(
      buildLessonDesignStudioHref({
        entryContext,
        notice: notice ?? "draft-not-found",
      })
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

  const phaseFromSlug = studioStepSlugToPhase(String(step ?? "").trim().toLowerCase());
  if (!phaseFromSlug) {
    redirect(
      buildLessonDesignStudioHref({
        entryContext,
        draftId,
        notice,
        phase: derivedPhase,
      })
    );
  }

  return (
    <StudioClient
      userId={session.user.id}
      userName={session.user.name ?? "Instructor"}
      entryContext={entryContext}
      notice={notice}
      studioPhase={phaseFromSlug}
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
