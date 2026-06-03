"use client";

import { useCallback, type ReactNode } from "react";
import shell from "@/components/instructor-onboarding/instructor-onboarding-guide.module.css";
import OnboardingStepper from "@/components/instructor-onboarding/onboarding-stepper";

/* ------------------------------------------------------------------
   Training Academy shell.

   Training is the same launchpad at a later phase, so it literally
   inherits the onboarding launchpad shell: the same left rail (vertical
   stepper + progress), the same fixed header, and the same step-in
   motion — by importing the onboarding CSS module and reusing the
   OnboardingStepper. The three milestone clusters appear in the rail;
   selecting one scrolls the matching cluster into view.
   ------------------------------------------------------------------ */

export interface ShellMilestone {
  id: string;
  label: string;
  kicker: string;
  complete: boolean;
}

export default function TrainingAcademyShell({
  milestones,
  activeIndex,
  progressPercent,
  eyebrow,
  title,
  railFooter,
  children,
}: {
  milestones: ShellMilestone[];
  activeIndex: number;
  progressPercent: number;
  eyebrow: string;
  title: string;
  railFooter?: ReactNode;
  children: ReactNode;
}) {
  const handleSelect = useCallback(
    (index: number) => {
      const target = milestones[index];
      if (!target) return;
      const el = document.getElementById(`milestone-${target.id}`);
      if (!el) return;
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({
        behavior: prefersReduced ? "auto" : "smooth",
        block: "start",
      });
    },
    [milestones],
  );

  return (
    <div className={shell.launchpad}>
      {/* ---------- Left rail (desktop) ---------- */}
      <aside className={shell.rail}>
        <div className={shell.railHead}>
          <span className={shell.trailEyebrow}>{eyebrow}</span>
          <p className={shell.railProgressLabel}>{progressPercent}% complete</p>
        </div>
        <OnboardingStepper
          steps={milestones}
          activeIndex={activeIndex}
          reachedIndex={milestones.length - 1}
          completed={milestones.map((m) => m.complete)}
          onSelect={handleSelect}
        />
        {railFooter ? <div className={shell.railHelp}>{railFooter}</div> : null}
      </aside>

      {/* ---------- Right pane: fixed header + scrollable content ---------- */}
      <div className={shell.main}>
        <header className={shell.mainHeader}>
          <div className={shell.mobilePill} aria-hidden>
            <span className={shell.mobilePillText}>
              {milestones[activeIndex]?.label ?? title} · {progressPercent}% complete
            </span>
            <div className={shell.mobileProgress}>
              <span
                className={shell.mobileProgressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={shell.headerRow}>
            <div>
              <p className={shell.eyebrow}>{eyebrow}</p>
              <h1 className={shell.title}>{title}</h1>
            </div>
            <span className={shell.progressMeta}>
              <strong>{progressPercent}% complete</strong>
            </span>
          </div>
        </header>

        <div className={shell.contentScroll}>{children}</div>
      </div>
    </div>
  );
}
