"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createJourney } from "@/lib/journey-editor/actions";

export function NewJourneyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;

    startTransition(async () => {
      try {
        const result = await createJourney({ slug, title, description });
        setOpen(false);
        router.push(`/admin/journeys/${result.journeyId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create journey.");
      }
    });
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + New Journey
      </button>
    );
  }

  return (
    <form
      className="card admin-form"
      action={(fd) => handleSubmit(fd)}
      onReset={() => {
        setOpen(false);
        setError(null);
      }}
    >
      <h2>New journey</h2>
      <label className="form-row">
        <span>Title</span>
        <input
          name="title"
          required
          minLength={3}
          placeholder="Instructor Onboarding"
        />
      </label>
      <label className="form-row">
        <span>Slug</span>
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9\-]*"
          placeholder="instructor-onboarding"
          title="Lowercase letters, digits, and hyphens only."
        />
      </label>
      <label className="form-row">
        <span>Description (optional)</span>
        <textarea name="description" rows={3} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button type="reset" className="btn">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}
