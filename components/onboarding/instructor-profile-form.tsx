"use client";

import { useRef, useState, useTransition } from "react";
import { saveOnboardingProfile } from "@/lib/onboarding-actions";
import { completeJourneyStep } from "@/lib/instructor-journey-actions";
import { Button } from "@/components/ui-v2";

export interface InstructorProfileFormData {
  bio?: string | null;
  school?: string | null;
  interests?: string[];
  curriculumUrl?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  dateOfBirth?: string | null;
}

interface InstructorProfileFormProps {
  profileData?: InstructorProfileFormData | null;
  /** Called after the profile saves successfully (advances the launchpad). */
  onSaved: () => void;
  onBack: () => void;
}

/**
 * Inline instructor profile form. Ported verbatim from the retired onboarding
 * wizard's `InstructorSteps` (currentStep === 1) — same fields, same hints,
 * same server-side validation via `saveOnboardingProfile`. Rendered inline in
 * the launchpad content pane (no modal / drawer).
 */
export default function InstructorProfileForm({
  profileData,
  onSaved,
  onBack,
}: InstructorProfileFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      try {
        const result = await saveOnboardingProfile(formData);
        if (result?.error) {
          setFormError(result.error);
          return;
        }
        await completeJourneyStep("profile", 2);
        onSaved();
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : "We could not save that yet.",
        );
      }
    });
  }

  return (
    <form ref={formRef} className="onboarding-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="bio">About You &amp; Teaching Experience</label>
        <textarea
          id="bio"
          name="bio"
          className="input"
          placeholder="Share your background, teaching experience, and what drives you as an instructor..."
          rows={4}
          defaultValue={profileData?.bio ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="interests">Subject Areas / Expertise</label>
        <input
          id="interests"
          name="interests"
          className="input"
          placeholder="e.g. Music Production, Web Development, Creative Writing"
          defaultValue={profileData?.interests?.join(", ") ?? ""}
        />
        <span className="onboarding-hint">Separate with commas</span>
      </div>

      <div className="form-row">
        <label htmlFor="school">School / Organization (if applicable)</label>
        <input
          id="school"
          name="school"
          className="input"
          placeholder="e.g. Lincoln High School, Community Center"
          defaultValue={profileData?.school ?? ""}
        />
      </div>

      {/* Standard contact / location info — prefilled from the application when
          we already have it, so instructors only fill the gaps. */}
      <div className="form-row">
        <label htmlFor="city">City</label>
        <input
          id="city"
          name="city"
          className="input"
          placeholder="e.g. Boston"
          defaultValue={profileData?.city ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="stateProvince">State / Province</label>
        <input
          id="stateProvince"
          name="stateProvince"
          className="input"
          placeholder="e.g. MA"
          defaultValue={profileData?.stateProvince ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="dateOfBirth">Date of Birth</label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          className="input"
          defaultValue={profileData?.dateOfBirth ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="curriculumUrl">Curriculum / Portfolio Link (optional)</label>
        <input
          id="curriculumUrl"
          name="curriculumUrl"
          type="url"
          className="input"
          placeholder="https://your-portfolio.com"
          defaultValue={profileData?.curriculumUrl ?? ""}
        />
      </div>

      {formError ? <div className="form-error">{formError}</div> : null}

      <div className="onboarding-actions">
        <Button type="submit" variant="primary" loading={isPending}>
          Save &amp; Continue
        </Button>
        <div className="onboarding-actions-secondary">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            disabled={isPending}
          >
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSaved}
            disabled={isPending}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </form>
  );
}
