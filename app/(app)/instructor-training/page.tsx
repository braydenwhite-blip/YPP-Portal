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

  const milestones = model.phases.map((p) => ({
    id: p.id,
    label: p.title,
    kicker: p.kicker,
    complete: p.state === "complete",
  }));

  // `?from=<moduleId>` is set by the journey route's back link, so returning
  // from a module opens that step, animates its check in, and (if it finished a
  // phase) fires the phase-complete celebration.
  const fromRaw = sp.from;
  const fromId = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const allModuleIds = new Set(model.phases.flatMap((p) => p.modules.map((m) => m.id)));
  const justCompletedId = fromId && allModuleIds.has(fromId) ? fromId : null;

  const banners = (
    <>
      {isSummerWorkshop && (
        <div className="card" role="status" style={{ borderColor: "#a78bfa", background: "#f5f3ff" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#5b21b6", lineHeight: 1.55 }}>
            <strong>Summer Workshop Instructor track.</strong> Complete required training, then
            propose the focused workshop you&rsquo;ll lead in the{" "}
            <Link href="/instructor/workshop-design-studio" className="link">
              Workshop Design Studio
            </Link>
            . Strong workshop instructors may be considered for full instructor responsibilities;
            the Lesson Design Studio capstone becomes a follow-up if and when that happens.
          </p>
        </div>
      )}

      {wasPromotedFromSummerWorkshop ? (
        <div className="card" role="status" style={{ borderColor: "#16a34a", background: "#f0fdf4" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#14532d", lineHeight: 1.55 }}>
            <strong>Promoted to full Instructor.</strong> Your existing workshop submission is
            preserved. The next step on the standard track is the{" "}
            <Link href="/instructor/lesson-design-studio?entry=training" className="link">
              Lesson Design Studio capstone
            </Link>
            {" — "}finish that to clear training and unlock offering approval.
          </p>
        </div>
      ) : null}

      {showLdsLockedBanner && !readinessCheckPassed && !isSummerWorkshop ? (
        <div className="card" role="status" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>Lesson Design Studio is locked.</strong> Complete the Readiness Check first
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
          </p>
        </div>
      ) : null}

      {showWorkshopLockedBanner && !readinessCheckPassed && isSummerWorkshop ? (
        <div className="card" role="status" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>Workshop Design Studio is locked.</strong> Complete the Readiness Check first
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
          </p>
        </div>
      ) : null}

      {showWorkshopClosedBanner ? (
        <div className="card" role="status" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>Workshop Design Studio is closed.</strong> The design window is not currently
            open. We&apos;ll let you know when the studio reopens for the next workshop cycle.
          </p>
        </div>
      ) : null}
    </>
  );

  return (
    <TrainingAcademyShell
      milestones={milestones}
      activeIndex={model.activePhaseIndex}
      progressPercent={model.progress.pct}
      eyebrow="Instructor Launchpad · Training"
      title="Your Training Journey"
      railFooter={
        <div style={{ display: "grid", gap: 10 }}>
          <Link href="/instructor-onboarding" className="link" style={{ fontSize: 13 }}>
            ← Back to your launchpad
          </Link>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Training is your launchpad, one phase on. Clear all three phases to unlock your
            curriculum review and start teaching.
          </p>
        </div>
      }
    >
      <TrainingHome model={model} justCompletedId={justCompletedId} bannersSlot={banners} />
    </TrainingAcademyShell>
  );
}
