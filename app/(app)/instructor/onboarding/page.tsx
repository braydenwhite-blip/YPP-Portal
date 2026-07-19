import Link from "next/link";
import { PageHeaderV2, CardV2, StatusBadge } from "@/components/ui-v2";
import { getInstructorOnboarding } from "@/lib/session8/instructor-development";
import { shortDate } from "@/lib/session8/format";
import { OnboardingStepActions } from "./onboarding-step-actions";

export default async function InstructorOnboardingPage() {
  const { steps, completedCount, totalCount } = await getInstructorOnboarding();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Instructor development"
        title="Onboarding checklist"
        subtitle={`${completedCount} of ${totalCount} steps complete.`}
      />

      <div className="space-y-3">
        {steps.map((step) => (
          <CardV2 key={step.key} padding="md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{step.title}</h2>
                  <StatusBadge tone={step.completed ? "success" : "warning"}>
                    {step.completed ? "Complete" : "Incomplete"}
                  </StatusBadge>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {step.kind === "derived" ? "Auto-checked" : "Self-attested"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{step.description}</p>
                {step.completed && step.completedAt ? (
                  <p className="mt-1 text-xs text-ink-muted">Completed {shortDate(step.completedAt)}</p>
                ) : null}
                {step.kind === "derived" && !step.completed && step.actionHref ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    This step completes automatically once the underlying data exists.
                  </p>
                ) : null}
                {step.actionHref ? (
                  <Link href={step.actionHref} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
                    {step.actionLabel ?? "Go"} →
                  </Link>
                ) : null}
              </div>
              {step.kind === "self-attest" ? (
                <div className="shrink-0">
                  <OnboardingStepActions stepKey={step.key} completed={step.completed} />
                </div>
              ) : null}
            </div>
          </CardV2>
        ))}
      </div>
    </main>
  );
}
