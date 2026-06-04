"use client";

/**
 * ContentBlock — a purely instructional beat. Teaches through prose, not a
 * game: the learner reads one or more sections (and an optional image), then
 * continues. No answer key, no score.
 *
 * Response shape: { acknowledged: true }
 * Emitted once on mount so the player's "continue" affordance unlocks — there
 * is nothing to "answer," the learner just reads and moves on.
 *
 * readOnly has no effect on rendering (the content is static either way); it
 * exists only to satisfy the shared beat-body contract.
 */

import { useEffect } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape (client-safe — sections + optional media only)
// ---------------------------------------------------------------------------

type Section = {
  id: string;
  heading?: string;
  body: string;
};

type Media = {
  url: string;
  alt?: string;
  caption?: string;
};

type ContentBlockConfig = {
  sections: Section[];
  media?: Media | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ContentBlockProps = {
  beat: ClientBeat & { config: unknown };
  response: { acknowledged: true } | null;
  onResponseChange: (next: { acknowledged: true } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentBlock({
  beat,
  response,
  onResponseChange,
}: ContentBlockProps) {
  const config = beat.config as ContentBlockConfig;
  const sections = config.sections ?? [];
  const media = config.media ?? null;

  // Nothing to answer — mark the block acknowledged as soon as it renders so
  // the player can advance. Re-affirms on resume (response already non-null).
  useEffect(() => {
    if (response?.acknowledged !== true) {
      onResponseChange({ acknowledged: true });
    }
  }, [response, onResponseChange]);

  return (
    <div className="content-block">
      {sections.map((section) => (
        <section key={section.id} className="content-block__section">
          {section.heading && (
            <h3 className="content-block__heading">{section.heading}</h3>
          )}
          <p className="content-block__body">{section.body}</p>
        </section>
      ))}

      {media && (
        <figure className="content-block__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt={media.alt ?? ""} className="content-block__image" />
          {media.caption && (
            <figcaption className="content-block__caption">{media.caption}</figcaption>
          )}
        </figure>
      )}
    </div>
  );
}
