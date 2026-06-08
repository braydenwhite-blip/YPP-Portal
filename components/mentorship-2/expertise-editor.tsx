"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  setMentorExpertise,
  removeMentorExpertise,
} from "@/lib/mentorship-2/expertise-actions";
import {
  EXPERTISE_PROFICIENCIES,
  EXPERTISE_PROFICIENCY_LABELS,
  type ExpertiseProficiency,
} from "@/lib/mentorship-2/constants";

type AreaOption = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
};

type CurrentClaim = {
  expertiseAreaId: string;
  proficiency: string | null;
};

export function ExpertiseEditor({
  areas,
  current,
}: {
  areas: AreaOption[];
  current: CurrentClaim[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const claimed = new Map(current.map((c) => [c.expertiseAreaId, c.proficiency]));

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update expertise.");
      }
    });
  }

  // Group areas by category for a tidy editor.
  const byCategory = new Map<string, AreaOption[]>();
  for (const area of areas) {
    const key = area.category ?? "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), area]);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      {Array.from(byCategory.entries()).map(([category, group]) => (
        <section key={category} className="card" style={{ display: "grid", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {category}
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {group.map((area) => {
              const isClaimed = claimed.has(area.id);
              const proficiency = claimed.get(area.id) ?? "";
              return (
                <div
                  key={area.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: isClaimed ? 600 : 400 }}>{area.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select
                      value={proficiency}
                      disabled={isPending}
                      onChange={(e) =>
                        run(() =>
                          setMentorExpertise({
                            expertiseAreaId: area.id,
                            proficiency:
                              (e.target.value as ExpertiseProficiency) || null,
                          })
                        )
                      }
                      aria-label={`Proficiency in ${area.name}`}
                    >
                      <option value="">{isClaimed ? "Claimed" : "Not selected"}</option>
                      {EXPERTISE_PROFICIENCIES.map((p) => (
                        <option key={p} value={p}>
                          {EXPERTISE_PROFICIENCY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    {isClaimed && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={isPending}
                        onClick={() =>
                          run(() =>
                            removeMentorExpertise({ expertiseAreaId: area.id })
                          )
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
