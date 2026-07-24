"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateHiringApplicationMaterials } from "@/lib/application-actions";
import { Button, cn } from "@/components/ui-v2";
import type { SocialMediaManagerMetadata } from "@/lib/social-media-manager-application";

type Mode = "social_media" | "chapter_proposal" | "generic";

type ChapterProposalValues = {
  chapterName: string;
  city: string;
  region: string;
  partnerSchool: string;
  chapterVision: string;
  launchPlan: string;
  recruitmentPlan: string;
  additionalContext: string;
  coverLetter: string;
};

const fieldClass =
  "w-full rounded-[10px] border border-line-soft bg-surface px-3 py-2.5 text-[14px] text-ink shadow-sm placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

const labelClass = "block text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function HiringApplicationMaterialsEditor({
  applicationId,
  mode,
  coverLetter = "",
  additionalMaterials = "",
  socialMedia = null,
  chapterProposal = null,
  canEdit,
}: {
  applicationId: string;
  mode: Mode;
  coverLetter?: string;
  additionalMaterials?: string;
  socialMedia?: SocialMediaManagerMetadata | null;
  chapterProposal?: Partial<ChapterProposalValues> | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [whyJoin, setWhyJoin] = useState(coverLetter);
  const [school, setSchool] = useState(socialMedia?.school ?? "");
  const [grade, setGrade] = useState(socialMedia?.grade ?? "");
  const [platforms, setPlatforms] = useState(socialMedia?.platforms ?? "");
  const [experience, setExperience] = useState(socialMedia?.experience ?? "");
  const [portfolioLinks, setPortfolioLinks] = useState(socialMedia?.portfolioLinks ?? "");
  const [contentIdeas, setContentIdeas] = useState(socialMedia?.contentIdeas ?? "");
  const [weeklyAvailability, setWeeklyAvailability] = useState(
    socialMedia?.weeklyAvailability ?? ""
  );
  const [additionalNotes, setAdditionalNotes] = useState(socialMedia?.additionalNotes ?? "");

  const [genericCover, setGenericCover] = useState(coverLetter);
  const [genericMaterials, setGenericMaterials] = useState(additionalMaterials);

  const [proposal, setProposal] = useState<ChapterProposalValues>({
    chapterName: chapterProposal?.chapterName ?? "",
    city: chapterProposal?.city ?? "",
    region: chapterProposal?.region ?? "",
    partnerSchool: chapterProposal?.partnerSchool ?? "",
    chapterVision: chapterProposal?.chapterVision ?? "",
    launchPlan: chapterProposal?.launchPlan ?? "",
    recruitmentPlan: chapterProposal?.recruitmentPlan ?? "",
    additionalContext: chapterProposal?.additionalContext ?? "",
    coverLetter: chapterProposal?.coverLetter ?? coverLetter,
  });

  if (!canEdit) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result =
        mode === "social_media"
          ? await updateHiringApplicationMaterials({
              applicationId,
              socialMedia: {
                school,
                grade,
                platforms,
                experience,
                portfolioLinks,
                contentIdeas,
                weeklyAvailability,
                additionalNotes,
                whyJoin,
              },
            })
          : mode === "chapter_proposal"
            ? await updateHiringApplicationMaterials({
                applicationId,
                coverLetter: proposal.coverLetter,
                chapterProposal: {
                  chapterName: proposal.chapterName,
                  city: proposal.city,
                  region: proposal.region,
                  partnerSchool: proposal.partnerSchool,
                  chapterVision: proposal.chapterVision,
                  launchPlan: proposal.launchPlan,
                  recruitmentPlan: proposal.recruitmentPlan,
                  additionalContext: proposal.additionalContext,
                },
              })
            : await updateHiringApplicationMaterials({
                applicationId,
                coverLetter: genericCover,
                additionalMaterials: genericMaterials,
              });

      if (!result.success) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: "Saved." });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="rounded-[9px] border border-line-soft bg-surface-soft px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:border-brand-300 hover:bg-brand-50"
        >
          {coverLetter || socialMedia || chapterProposal?.chapterName || additionalMaterials
            ? "Edit responses"
            : "Add responses"}
        </button>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {mode === "social_media"
              ? "Written responses"
              : mode === "chapter_proposal"
                ? "Chapter proposal"
                : "Application materials"}
          </p>

          {mode === "social_media" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="School">
                <input
                  className={fieldClass}
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  required
                />
              </Field>
              <Field label="Grade">
                <select
                  className={fieldClass}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option value="9">9th</option>
                  <option value="10">10th</option>
                  <option value="11">11th</option>
                  <option value="12">12th</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Platforms">
                  <input
                    className={fieldClass}
                    value={platforms}
                    onChange={(e) => setPlatforms(e.target.value)}
                    placeholder="Instagram, TikTok, …"
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Experience">
                  <textarea
                    className={cn(fieldClass, "min-h-[88px] resize-y")}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Portfolio / links">
                  <input
                    className={fieldClass}
                    value={portfolioLinks}
                    onChange={(e) => setPortfolioLinks(e.target.value)}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Why they want to join">
                  <textarea
                    className={cn(fieldClass, "min-h-[88px] resize-y")}
                    value={whyJoin}
                    onChange={(e) => setWhyJoin(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Content ideas">
                  <textarea
                    className={cn(fieldClass, "min-h-[88px] resize-y")}
                    value={contentIdeas}
                    onChange={(e) => setContentIdeas(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Weekly availability">
                  <textarea
                    className={cn(fieldClass, "min-h-[72px] resize-y")}
                    value={weeklyAvailability}
                    onChange={(e) => setWeeklyAvailability(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Additional notes">
                  <textarea
                    className={cn(fieldClass, "min-h-[72px] resize-y")}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          ) : mode === "chapter_proposal" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["chapterName", "Proposed chapter", false],
                  ["city", "City", false],
                  ["region", "Region", false],
                  ["partnerSchool", "Partner school", false],
                  ["chapterVision", "Vision", true],
                  ["launchPlan", "Launch plan", true],
                  ["recruitmentPlan", "Recruitment plan", true],
                  ["additionalContext", "Additional context", true],
                  ["coverLetter", "Leadership bio / cover letter", true],
                ] as const
              ).map(([key, label, multiline]) => (
                <div
                  key={key}
                  className={
                    multiline || key === "chapterName" || key === "partnerSchool"
                      ? "sm:col-span-2"
                      : undefined
                  }
                >
                  <Field label={label}>
                    {multiline ? (
                      <textarea
                        className={cn(fieldClass, "min-h-[80px] resize-y")}
                        value={proposal[key]}
                        onChange={(e) =>
                          setProposal((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        className={fieldClass}
                        value={proposal[key]}
                        onChange={(e) =>
                          setProposal((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        required={key === "chapterName"}
                      />
                    )}
                  </Field>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              <Field label="Cover letter">
                <textarea
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                  value={genericCover}
                  onChange={(e) => setGenericCover(e.target.value)}
                />
              </Field>
              <Field label="Additional materials">
                <textarea
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                  value={genericMaterials}
                  onChange={(e) => setGenericMaterials(e.target.value)}
                />
              </Field>
            </div>
          )}

          {message ? (
            <p
              role="alert"
              className={cn(
                "m-0 rounded-[10px] px-3 py-2 text-[13px] font-medium",
                message.ok
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-[var(--error-bg)] text-[var(--error-text)]"
              )}
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending} loading={pending}>
              Save responses
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setMessage(null);
              }}
              className="rounded-[9px] border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
