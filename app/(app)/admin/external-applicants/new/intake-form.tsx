"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import {
  createExternalChapterPresidentApplicantFromForm,
  createExternalInstructorApplicantFromForm,
  createExternalStaffApplicantFromForm,
} from "@/lib/external-applicant-intake";

interface StaffPosition {
  id: string;
  title: string;
  chapterName: string | null;
}

interface Props {
  chapters: Array<{ id: string; name: string }>;
  staffPositions: StaffPosition[];
  /** Prefills Staff opening — usually Social Media Manager. */
  defaultStaffPositionId?: string;
  scopedChapterId: string | null;
  hasNetworkScope: boolean;
  canAddChapterPresident: boolean;
  canAddStaff: boolean;
}

type ApplicantKind = "INSTRUCTOR" | "CHAPTER_PRESIDENT" | "STAFF";
type SourceKind = "GOOGLE_FORMS" | "MANUAL_ADMIN_ENTRY";

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");
const selectClass = inputClass;

function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
          {hint ? (
            <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
    active
      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
      : "border-line-soft bg-surface text-ink-muted hover:border-brand-300 hover:text-ink"
  );
}

export default function ExternalApplicantIntakeForm({
  chapters,
  staffPositions,
  defaultStaffPositionId = "",
  scopedChapterId,
  hasNetworkScope,
  canAddChapterPresident,
  canAddStaff,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceKind>("MANUAL_ADMIN_ENTRY");
  const [kind, setKind] = useState<ApplicantKind>("INSTRUCTOR");

  const kindOptions = useMemo(() => {
    const options: Array<{ value: ApplicantKind; label: string }> = [
      { value: "INSTRUCTOR", label: "Instructor" },
    ];
    if (canAddStaff) options.push({ value: "STAFF", label: "Staff" });
    if (canAddChapterPresident) {
      options.push({ value: "CHAPTER_PRESIDENT", label: "Chapter President" });
    }
    return options;
  }, [canAddChapterPresident, canAddStaff]);

  const activeKind =
    kindOptions.some((option) => option.value === kind) ? kind : "INSTRUCTOR";
  const isCP = activeKind === "CHAPTER_PRESIDENT";
  const isStaff = activeKind === "STAFF";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("source", source);

    startTransition(async () => {
      if (isStaff) {
        const result = await createExternalStaffApplicantFromForm(formData);
        if (result.ok) {
          router.push(`/applications/${result.applicationId}`);
          router.refresh();
        } else {
          setError(result.error);
        }
        return;
      }
      if (isCP) {
        const result = await createExternalChapterPresidentApplicantFromForm(formData);
        if (result.ok) {
          router.push(`/admin/chapter-president-applicants/${result.applicationId}`);
          router.refresh();
        } else {
          setError(result.error);
        }
        return;
      }
      const result = await createExternalInstructorApplicantFromForm(formData);
      if (result.ok) {
        router.push(`/admin/instructor-applicants/${result.applicationId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      id="add-applicant"
      className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card"
    >
      <form onSubmit={submit} className="flex flex-col">
        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
          <FeedbackBanner message={error} tone="error" style={{ padding: "10px 14px" }} />

          {kindOptions.length > 1 ? (
            <div className="space-y-2">
              <p className="m-0 text-[13px] font-semibold text-ink">Applicant type</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Applicant type">
                {kindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setKind(option.value)}
                    className={chipClass(activeKind === option.value)}
                    aria-pressed={activeKind === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <input type="hidden" name="kind" value="INSTRUCTOR" />
          )}

          <FormSection step={1} title="Who is applying?" hint="Legal name and email.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[13px] font-semibold text-ink">First name</span>
                <input
                  className={titleInputClass}
                  name="name"
                  required
                  placeholder="Alex"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[13px] font-semibold text-ink">Last name</span>
                <input className={inputClass} name="lastName" required placeholder="Rivera" />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-ink">Email</span>
              <input
                className={inputClass}
                type="email"
                name="email"
                required
                placeholder="applicant@example.com"
              />
            </label>
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection
            step={2}
            title="Which chapter?"
            hint={
              isCP
                ? "Optional — leave blank if they are founding a new chapter."
                : "Where they would teach, work, or lead."
            }
          >
            {hasNetworkScope ? (
              <select className={selectClass} name="chapterId" defaultValue="">
                <option value="">{isCP ? "No chapter yet / new chapter" : "No chapter yet"}</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="chapterId" value={scopedChapterId ?? ""} />
                <input
                  className={inputClass}
                  value={chapters[0]?.name ?? "No chapter assigned"}
                  disabled
                />
              </>
            )}
          </FormSection>

          <div className="rounded-[14px] border border-dashed border-line-soft bg-surface/60">
            <div className="border-b border-line-soft px-4 py-3.5">
              <p className="m-0 text-[13.5px] font-semibold text-ink">Notes & extras</p>
              <p className="m-0 mt-0.5 text-[12px] text-ink-muted">Optional</p>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <p className="m-0 text-[13px] font-semibold text-ink">Where did they apply?</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSource("MANUAL_ADMIN_ENTRY")}
                    className={chipClass(source === "MANUAL_ADMIN_ENTRY")}
                  >
                    Manual entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("GOOGLE_FORMS")}
                    className={chipClass(source === "GOOGLE_FORMS")}
                  >
                    Google Forms
                  </button>
                </div>
              </div>

              {!isCP && !isStaff ? (
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-semibold text-ink">Track</span>
                  <select className={selectClass} name="applicationTrack" defaultValue="STANDARD_INSTRUCTOR">
                    <option value="STANDARD_INSTRUCTOR">Full Instructor</option>
                    <option value="SUMMER_WORKSHOP_INSTRUCTOR">Summer Workshop</option>
                  </select>
                </label>
              ) : null}

              {isStaff ? (
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-semibold text-ink">Staff opening</span>
                  <select
                    className={selectClass}
                    name="positionId"
                    defaultValue={defaultStaffPositionId}
                    required={staffPositions.length > 0}
                  >
                    {staffPositions.length === 0 ? (
                      <option value="">No open staff positions</option>
                    ) : null}
                    {staffPositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                        {position.chapterName ? ` · ${position.chapterName}` : ""}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" name="positionTitle" value="Social Media Manager" />
                </label>
              ) : null}

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink">Phone</span>
                <input className={inputClass} name="phone" placeholder="Optional" />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink">
                  {source === "GOOGLE_FORMS" ? "Form answers or context" : "Conversation notes"}
                </span>
                <textarea
                  className={cn(inputClass, "min-h-[96px] resize-y")}
                  name="externalAnswersCopy"
                  rows={3}
                  placeholder="Paste answers or a short summary for reviewers."
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink">Internal notes</span>
                <textarea
                  className={cn(inputClass, "min-h-[72px] resize-y")}
                  name="internalNotes"
                  rows={2}
                  placeholder="Admin-only — not shared with the applicant."
                />
              </label>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
          <p className="m-0 text-[12.5px] text-ink-muted">
            {isStaff
              ? "Creates a Staff application (opens a position if needed)."
              : isCP
                ? "Creates a Chapter President application on the board."
                : "Creates an Instructor application on the board."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/instructor-applicants" variant="ghost" size="md">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending
                ? "Adding…"
                : isStaff
                  ? "Add Staff Applicant →"
                  : isCP
                    ? "Add CP Applicant →"
                    : "Add Instructor →"}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
