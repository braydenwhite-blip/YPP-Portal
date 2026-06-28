"use client";

// Family signup panel on the public class detail page. Reuses the existing
// race-safe enrollInClass for signed-in students (capacity + waitlist +
// duplicate handled there), and routes everyone else to the right real path.
// On success it shows a reassuring "what happens next" confirmation.

import { useState, useTransition } from "react";

import { CardV2, Button, ButtonLink, StatusBadge } from "@/components/ui-v2";
import { enrollInClass } from "@/lib/class-management-actions";
import { buildSignupConfirmation, type SignupAvailability, type SignupConfirmation } from "@/lib/classes/public-catalog";

type Props = {
  offeringId: string;
  title: string;
  scheduleLabel: string;
  locationLabel: string;
  availability: SignupAvailability;
  viewer: { isAuthenticated: boolean; isStudent: boolean; alreadyEnrolled: boolean };
};

export function ClassSignupPanel(props: Props) {
  const { offeringId, title, scheduleLabel, locationLabel, availability, viewer } = props;
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<SignupConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (confirmation) return <Confirmation c={confirmation} />;

  if (viewer.alreadyEnrolled) {
    return (
      <Shell title="You're signed up">
        <p className="m-0 text-[13.5px] text-ink-muted">You&rsquo;re already enrolled in this class.</p>
        <ButtonLink href="/my-classes" variant="primary" size="sm">
          Go to My Classes
        </ButtonLink>
      </Shell>
    );
  }

  if (availability === "closed") {
    return (
      <Shell title="Enrollment closed">
        <p className="m-0 text-[13.5px] text-ink-muted">This class isn&rsquo;t accepting signups right now.</p>
        <ButtonLink href="/classes" variant="secondary" size="sm">
          Browse other classes
        </ButtonLink>
      </Shell>
    );
  }

  if (!viewer.isAuthenticated) {
    return (
      <Shell title="Sign up your student">
        <p className="m-0 text-[13.5px] text-ink-muted">
          Create a free family account to enroll — it takes a couple of minutes.
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/signup?next=/classes/${offeringId}`} variant="primary" size="sm">
            Create a family account
          </ButtonLink>
          <ButtonLink href={`/login?next=/classes/${offeringId}`} variant="secondary" size="sm">
            I already have an account
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  if (!viewer.isStudent) {
    // A signed-in parent/guardian enrolls their child from the family portal.
    return (
      <Shell title="Enroll your student">
        <p className="m-0 text-[13.5px] text-ink-muted">
          Open your family portal to enroll one of your students in this class.
        </p>
        <ButtonLink href="/parent" variant="primary" size="sm">
          Go to my family portal
        </ButtonLink>
      </Shell>
    );
  }

  // Signed-in student — real self-enroll with a short fit check.
  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await enrollInClass(offeringId, { goal: goal.trim() || undefined, note: note.trim() || undefined });
        setConfirmation(
          buildSignupConfirmation({
            title,
            scheduleLabel,
            locationLabel,
            waitlisted: res.waitlisted,
            waitlistPosition: res.waitlistPosition,
          })
        );
      } catch {
        setError("Something went wrong enrolling. Please try again.");
      }
    });
  }

  return (
    <Shell title={availability === "waitlist" ? "Join the waitlist" : "Sign up for this class"}>
      {availability === "waitlist" && (
        <p className="m-0 text-[12.5px] text-progress-700">This class is full — you&rsquo;ll join the waitlist.</p>
      )}
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
        What do you hope to get out of this class? (optional)
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
        Anything the instructor should know? (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        {error && <span className="text-[12.5px] font-semibold text-blocked-700">{error}</span>}
        <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending} className="ml-auto">
          {availability === "waitlist" ? "Join waitlist" : "Enroll now"}
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <CardV2 className="border-brand-100 bg-brand-50/50">
      <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
      <div className="mt-2 flex flex-col gap-2.5">{children}</div>
    </CardV2>
  );
}

function Confirmation({ c }: { c: SignupConfirmation }) {
  return (
    <CardV2 className="border-complete-200 bg-complete-50/60">
      <div className="flex items-center gap-2">
        <StatusBadge tone={c.waitlisted ? "warning" : "success"} withDot>
          {c.waitlisted ? `Waitlisted${c.waitlistPosition ? ` · #${c.waitlistPosition}` : ""}` : "Enrolled"}
        </StatusBadge>
        <h2 className="m-0 text-[15px] font-bold text-ink">{c.waitlisted ? "You're on the waitlist" : "You're enrolled!"}</h2>
      </div>
      <p className="m-0 mt-1.5 text-[13.5px] text-ink-muted">{c.title}</p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {c.nextSteps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-ink">
            <span aria-hidden className="mt-0.5 text-complete-700">✓</span>
            {step}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <ButtonLink href="/my-classes" variant="primary" size="sm">
          Go to My Classes
        </ButtonLink>
      </div>
    </CardV2>
  );
}
