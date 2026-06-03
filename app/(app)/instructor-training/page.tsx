import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";
import {
  getTrainingAccessRedirect,
  hasApprovedInstructorTrainingAccess,
} from "@/lib/training-access";
import { getTrainingHomeModel } from "@/lib/training-home-model";
import TrainingAcademyShell from "@/components/instructor-training/training-academy-shell";
import TrainingHome from "@/components/instructor-training/training-home";
import TrainingBanner from "@/components/instructor-training/training-banner";

export default async function InstructorTrainingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!hasApprovedInstructorTrainingAccess(roles)) {
    redirect(getTrainingAccessRedirect(roles));
  }

  const sp = (await searchParams) ?? {};
  const lockedParamRaw = sp.locked;
  const lockedParam = Array.isArray(lockedParamRaw) ? lockedParamRaw[0] : lockedParamRaw;
  const showLdsLockedBanner = lockedParam === "lesson-design-studio";
  const showWorkshopLockedBanner = lockedParam === "workshop-design-studio";
  const showWorkshopClosedBanner = lockedParam === "workshop-design-studio-closed";

  const {
    model,
    isSummerWorkshop,
    wasPromotedFromSummerWorkshop,
    readinessCheckPassed,
    readinessCheckModuleId,
  } = await getTrainingHomeModel(session.user.id);

  const milestones = model.goals.map((g) => ({
    id: g.id,
    label: g.title,
    kicker: g.badge || (g.kind === "welcome" ? "Welcome" : g.kind === "studio" ? "Capstone" : "Readiness"),
    complete: g.state === "complete",
  }));

  // `?from=<moduleId>` is set by the journey route's back link, so returning
  // from a module opens that step, animates its check in, and (if it finished a
  // GOAL) fires the GOAL-complete celebration.
  const fromRaw = sp.from;
  const fromId = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const allModuleIds = new Set(model.goals.map((g) => g.id));
  const justCompletedId = fromId && allModuleIds.has(fromId) ? fromId : null;

  const banners = (
    <>
      {isSummerWorkshop && (
        <TrainingBanner variant="info" title="Summer Workshop Instructor track.">
          Complete required training, then propose the focused workshop you&rsquo;ll lead in the{" "}
          <Link href="/instructor/workshop-design-studio" className="link">
            Workshop Design Studio
          </Link>
          . Strong workshop instructors may be considered for full instructor responsibilities;
          the Lesson Design Studio capstone becomes a follow-up if and when that happens.
        </TrainingBanner>
      )}

      {wasPromotedFromSummerWorkshop ? (
        <TrainingBanner variant="success" title="Promoted to full Instructor.">
          Your existing workshop submission is preserved. The next step on the standard track is
          the{" "}
          <Link href="/instructor/lesson-design-studio?entry=training" className="link">
            Lesson Design Studio capstone
          </Link>
          {" — "}finish that to clear training and unlock offering approval.
        </TrainingBanner>
      ) : null}

      {showLdsLockedBanner && !readinessCheckPassed && !isSummerWorkshop ? (
        <TrainingBanner variant="warning" title="Lesson Design Studio is locked.">
          Complete the Readiness Check first
          {readinessCheckModuleId ? (
            <>
              {" — "}
              <Link href={`/training/${readinessCheckModuleId}`} className="link">
                open it now
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </TrainingBanner>
      ) : null}

      {showWorkshopLockedBanner && !readinessCheckPassed && isSummerWorkshop ? (
        <TrainingBanner variant="warning" title="Workshop Design Studio is locked.">
          Complete the Readiness Check first
          {readinessCheckModuleId ? (
            <>
              {" — "}
              <Link href={`/training/${readinessCheckModuleId}`} className="link">
                open it now
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </TrainingBanner>
      ) : null}

      {showWorkshopClosedBanner ? (
        <TrainingBanner variant="warning" title="Workshop Design Studio is closed.">
          The design window is not currently open. We&apos;ll let you know when the studio reopens
          for the next workshop cycle.
        </TrainingBanner>
      ) : null}
    </>
  );

  return (
    <TrainingAcademyShell
      milestones={milestones}
      activeIndex={model.activeGoalIndex}
      progressPercent={model.progress.pct}
      eyebrow="Instructor Academy"
      title="Your Instructor Academy"
      railFooter={
        <div style={{ display: "grid", gap: 10 }}>
          <Link href="/instructor-onboarding" className="link" style={{ fontSize: 13 }}>
            ← Back to your launchpad
          </Link>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Train against YPP&rsquo;s five GOALS, then pass the Readiness Check to unlock your
            curriculum review and start teaching.
          </p>
        </div>
      }
    >
      <TrainingHome model={model} justCompletedId={justCompletedId} bannersSlot={banners} />
    </TrainingAcademyShell>
  );
}
