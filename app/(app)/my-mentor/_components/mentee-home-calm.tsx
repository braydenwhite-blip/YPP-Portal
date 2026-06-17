import {
  PrimaryFocusCard,
  SimpleActionStrip,
  type SimpleAction,
} from "@/components/command-center/simple";

/**
 * Calm mentee home lead — one supportive next step. A mentee's home isn't a
 * triage queue, so Calm leads with warmth: while the kickoff is still being set
 * up, point them at their goals; once it's done, a gentle nudge to reflect or
 * book the next session. The dense workspace (goals, resources, progress,
 * reflections) stays one toggle away in Executive mode.
 */
export function MenteeCalmNextStep({
  mentorName,
  kickoffCompleted,
}: {
  mentorName: string;
  kickoffCompleted: boolean;
}) {
  const actions: SimpleAction[] = [
    { label: "Reflection", href: "/my-mentor/reflection", icon: "compass" },
    { label: "Schedule", href: "/my-mentor/schedule", icon: "calendar" },
    { label: "Goals", href: "/my-mentor/goals", icon: "target" },
    { label: "Pathway", href: "/leadership-pathway", icon: "activity" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {kickoffCompleted ? (
        <PrimaryFocusCard
          eyebrow="Stay connected"
          icon="compass"
          title={`Keep your momentum with ${mentorName}`}
          reason="Log a quick reflection or book your next session whenever you're ready."
          ctaLabel="Open your reflection"
          ctaHref="/my-mentor/reflection"
        />
      ) : (
        <PrimaryFocusCard
          eyebrow="Getting started"
          icon="flag"
          title="Your kickoff is being set up"
          reason={`Come ready with your goals — ${mentorName} will schedule the first session.`}
          ctaLabel="Review your goals"
          ctaHref="/my-mentor/goals"
        />
      )}
      <SimpleActionStrip actions={actions} />
    </div>
  );
}
