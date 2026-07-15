"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui-v2";
import { requestInstructorSupport } from "@/lib/session8/instructor-development-actions";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS } from "@/lib/session8/instructor-development";

export function SupportRequestForm() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [description, setDescription] = useState("");

  return (
    <form
      className="space-y-4"
      action={(formData: FormData) => {
        setSubmitted(false);
        startTransition(async () => {
          await requestInstructorSupport(formData);
          setDescription("");
          setSubmitted(true);
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-muted">Category</span>
        <select name="category" required className="w-full rounded-[9px] border border-line px-3 py-2 text-sm">
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPORT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-muted">What do you need help with?</span>
        <textarea
          name="description"
          required
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-[9px] border border-line px-3 py-2 text-sm"
          placeholder="Describe what's happening and what you need."
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" loading={pending}>
          Submit request
        </Button>
        {submitted ? <span className="text-xs font-medium text-complete-700">Request sent</span> : null}
      </div>
    </form>
  );
}
