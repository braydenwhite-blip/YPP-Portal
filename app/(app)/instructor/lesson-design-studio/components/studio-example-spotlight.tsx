"use client";

import {
  EXAMPLE_CURRICULA,
  EXAMPLE_CURRICULUM_ANNOTATIONS,
  EXAMPLE_WEEK_ANNOTATIONS,
  type ExampleCurriculum,
  type ExampleWeek,
} from "../examples-data";

interface StudioExampleSpotlightProps {
  mode: "course-map" | "session" | "launch";
  interestArea: string;
  selectedWeekNumber?: number;
  selectedSessionLabel?: string;
  onImportWeek?: (week: ExampleWeek) => void;
  onOpenLibrary?: () => void;
}

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreInterestMatch(exampleInterestArea: string, draftInterestArea: string) {
  const example = normalizeTopic(exampleInterestArea);
  const draft = normalizeTopic(draftInterestArea);
  if (!draft) return 0;
  if (example === draft) return 100;
  if (example.includes(draft) || draft.includes(example)) return 80;

  const draftWords = new Set(draft.split(" ").filter(Boolean));
  return example
    .split(" ")
    .filter((word) => draftWords.has(word)).length * 20;
}

function getRecommendedCurriculum(interestArea: string): ExampleCurriculum {
  if (!interestArea.trim()) return EXAMPLE_CURRICULA[0];

  return (
    EXAMPLE_CURRICULA.reduce<{
      curriculum: ExampleCurriculum;
      score: number;
    } | null>((best, curriculum) => {
      const score = scoreInterestMatch(curriculum.interestArea, interestArea);
      if (!best || score > best.score) {
        return { curriculum, score };
      }
      return best;
    }, null)?.curriculum ?? EXAMPLE_CURRICULA[0]
  );
}

export function StudioExampleSpotlight({
  mode,
  interestArea,
  selectedWeekNumber,
  selectedSessionLabel,
  onImportWeek,
  onOpenLibrary,
}: StudioExampleSpotlightProps) {
  const curriculum = getRecommendedCurriculum(interestArea);
  const annotations = EXAMPLE_CURRICULUM_ANNOTATIONS[curriculum.id];
  const targetWeek =
    typeof selectedWeekNumber === "number"
      ? curriculum.weeks.find((week) => week.weekNumber === selectedWeekNumber) ??
        curriculum.weeks[0]
      : curriculum.weeks[0];
  const weekAnnotations = EXAMPLE_WEEK_ANNOTATIONS[curriculum.id]?.[targetWeek.weekNumber];

  return (
    <aside className="lds-example-spotlight">
      <div className="lds-example-spotlight-header">
        <p className="lds-section-eyebrow">Inline example</p>
        <h3 className="lds-section-title">
          {mode === "course-map"
            ? "See how a strong course promise sounds"
            : mode === "session"
              ? "Study a model session arc while you build"
              : "Use the reviewer lens before you launch"}
        </h3>
        <p className="lds-section-copy">
          Recommended example: <strong>{curriculum.title}</strong> in{" "}
          {curriculum.interestArea}.
        </p>
      </div>

      {mode === "course-map" ? (
        <>
          <div className="lds-example-callout">
            <strong>{curriculum.title}</strong>
            <p>{curriculum.description}</p>
          </div>
          <div className="lds-example-list-card">
            <h4>What makes this course promise work</h4>
            <ul>
              {annotations.whyThisCurriculumWorks.slice(0, 3).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div className="lds-example-list-card">
            <h4>Outcome moves to borrow</h4>
            <ul>
              {curriculum.outcomes.slice(0, 4).map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {mode === "session" ? (
        <>
          <div className="lds-example-callout">
            <strong>
              {selectedSessionLabel ?? `Week ${targetWeek.weekNumber}`} example
            </strong>
            <p>{targetWeek.title}</p>
          </div>
          <div className="lds-example-list-card">
            <h4>Why this session works</h4>
            <ul>
              <li>{weekAnnotations?.whyThisWeekWorks ?? "The session has a clear arc from entry to application and reflection."}</li>
              <li>{weekAnnotations?.adaptIt ?? "Borrow the move, then change the language, examples, and pacing to fit your own students."}</li>
            </ul>
          </div>
          <div className="lds-example-list-card">
            <h4>Session moves to notice</h4>
            <ul>
              {targetWeek.activities.slice(0, 4).map((activity) => (
                <li key={`${targetWeek.weekNumber}-${activity.title}`}>
                  {activity.title} ({activity.durationMin} min)
                </li>
              ))}
            </ul>
          </div>
          <div className="lds-inline-actions">
            {onImportWeek ? (
              <button
                type="button"
                className="button"
                onClick={() => onImportWeek(targetWeek)}
              >
                Import this example week
              </button>
            ) : null}
            {onOpenLibrary ? (
              <button type="button" className="button secondary" onClick={onOpenLibrary}>
                Open full examples library
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {mode === "launch" ? (
        <>
          <div className="lds-example-list-card">
            <h4>Reviewer lens</h4>
            <ul>
              {annotations.reviewerLens.slice(0, 3).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div className="lds-example-list-card">
            <h4>Student experience highlights</h4>
            <ul>
              {annotations.studentExperienceHighlights.slice(0, 3).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          {onOpenLibrary ? (
            <div className="lds-inline-actions">
              <button type="button" className="button secondary" onClick={onOpenLibrary}>
                Review full examples library
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
