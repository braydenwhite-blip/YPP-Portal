"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitMentorshipApplication } from "@/lib/mentorship-2/application-actions";

type ExpertiseOption = { slug: string; name: string; category: string | null };

export function MentorshipApplyForm({
  expertiseAreas,
}: {
  expertiseAreas: ExpertiseOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");
  const [availability, setAvailability] = useState("");
  const [motivation, setMotivation] = useState("");
  const [preferred, setPreferred] = useState<string[]>([]);

  function togglePreferred(slug: string) {
    setPreferred((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitMentorshipApplication({
          goals: goals.trim() || undefined,
          interests: interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          preferredExpertise: preferred,
          availability: availability.trim() || undefined,
          motivation: motivation.trim() || undefined,
        });
        setDone(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit application.");
      }
    });
  }

  if (done) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--color-primary)" }}>
        <strong>Application submitted.</strong>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
          A program lead will review it and pair you with a mentor. You can track
          its status from your mentorship home.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          What do you want from mentorship?
        </span>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Your goals for this mentorship"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Interests</span>
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="Comma-separated, e.g. robotics, debate, writing"
        />
      </label>

      {expertiseAreas.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Mentor expertise you&apos;re looking for
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {expertiseAreas.map((area) => {
              const selected = preferred.includes(area.slug);
              return (
                <button
                  type="button"
                  key={area.slug}
                  onClick={() => togglePreferred(area.slug)}
                  className={selected ? "button small" : "button secondary small"}
                  aria-pressed={selected}
                >
                  {area.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Availability</span>
        <input
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          maxLength={500}
          placeholder="e.g. weekday evenings, Sunday afternoons"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Anything else for your future mentor? (optional)
        </span>
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </label>

      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div>
        <button type="submit" className="button" disabled={isPending}>
          {isPending ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
