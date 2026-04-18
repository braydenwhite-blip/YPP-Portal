"use client";

import Link from "next/link";
import {
  STUDIO_PHASES,
  buildLessonDesignStudioHref,
  type StudioEntryContext,
  type StudioPhase,
} from "@/lib/lesson-design-studio";

export function StudioPageNav({
  draftId,
  entryContext,
  activePhase,
}: {
  draftId: string;
  entryContext: StudioEntryContext;
  activePhase: StudioPhase;
}) {
  return (
    <nav className="lds-studio-page-nav" aria-label="Curriculum builder steps">
      <ul className="lds-studio-page-nav-list">
        {STUDIO_PHASES.map(({ id, label, shortLabel }) => {
          const href = buildLessonDesignStudioHref({
            draftId,
            phase: id,
            entryContext,
          });
          const isCurrent = id === activePhase;
          return (
            <li key={id}>
              <Link
                href={href}
                className={`lds-studio-page-nav-link${isCurrent ? " current" : ""}`}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={label}
                title={label}
              >
                {shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
