"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GrowthTag } from "@prisma/client";

import {
  GROWTH_TAG_META,
  GROWTH_TAG_VALUES,
} from "@/lib/people-strategy/growth-signals";
import { addGrowthTag, removeGrowthTag } from "@/lib/people-strategy/growth-actions";
import { Pill } from "@/components/people-strategy/pills";

/**
 * Inline editor for a member's growth tags. Renders current tags as removable
 * pills plus a compact "+ tag" picker. Officer-gated on the server; this is the
 * affordance layer. Mutations refresh the route so the Risk Radar recomputes.
 */
export function GrowthTagEditor({
  userId,
  tags,
}: {
  userId: string;
  tags: GrowthTag[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = new Set(tags);
  const addable = GROWTH_TAG_VALUES.filter((t) => !current.has(t));

  function mutate(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update tags.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {tags.map((tag) => {
        const meta = GROWTH_TAG_META[tag];
        return (
          <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <button
              type="button"
              onClick={() => mutate(() => removeGrowthTag({ userId, tag }))}
              disabled={pending}
              aria-label={`Remove ${meta.label}`}
              style={{
                border: "none",
                background: "transparent",
                cursor: pending ? "default" : "pointer",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        );
      })}

      {addable.length > 0 ? (
        open ? (
          <select
            className="input"
            aria-label="Add growth tag"
            defaultValue=""
            disabled={pending}
            style={{ fontSize: 12, padding: "2px 6px" }}
            onChange={(e) => {
              const tag = e.target.value as GrowthTag;
              if (tag) mutate(() => addGrowthTag({ userId, tag }));
              setOpen(false);
            }}
            onBlur={() => setOpen(false)}
          >
            <option value="" disabled>
              Choose a signal…
            </option>
            {addable.map((tag) => (
              <option key={tag} value={tag} title={GROWTH_TAG_META[tag].description}>
                {GROWTH_TAG_META[tag].label}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={pending}
            className="button outline small"
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            + tag
          </button>
        )
      ) : null}

      {error ? <span style={{ fontSize: 11, color: "var(--error-color)" }}>{error}</span> : null}
    </div>
  );
}
