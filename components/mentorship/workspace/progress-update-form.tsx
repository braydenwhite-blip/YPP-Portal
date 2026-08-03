"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { Button, CardV2 } from "@/components/ui-v2";
import {
  RATING_ORDER,
  getGoalRatingCopy,
} from "@/lib/mentorship-rubric-copy";
import { submitMonthlyProgressUpdate } from "@/lib/mentorship/progress-update-actions";
import type { ProgressRubricContext } from "@/lib/mentorship/progress-rubric";

export type ProgressGoalDraft = {
  goalId: string;
  source: "gr" | "legacy";
  title: string;
  collaborateWith: string;
  objective: string;
  actionItems: string;
  rating: GoalRatingColor;
  /** @deprecated prefer currentExpectationBullets */
  expectationBullets: string[];
  currentExpectationBullets?: string[];
  nextExpectationBullets?: string[];
  currentExpectationLabel?: string;
  nextExpectationLabel?: string | null;
  oneLiner?: string | null;
};

export type ProgressEmployeeProfile = {
  name: string;
  role: string | null;
  department: string | null;
  gradeLabel: string | null;
  hometown: string | null;
  location: string | null;
  hireDateLabel: string | null;
  mentorDisplay: string | null;
  chairDisplay: string | null;
};

const ACTION_PLAN_OPTIONS = [
  {
    id: "promotion",
    label: "On track for promotion to the next level",
  },
  {
    id: "improve",
    label: "Needs to improve in current role before considering promotion",
  },
  {
    id: "pip",
    label: "Performance improvement plan recommended",
  },
  {
    id: "early",
    label: "Too early to assess — continue developing in current role",
  },
] as const;

type ActionPlanId = (typeof ACTION_PLAN_OPTIONS)[number]["id"];

const ACTION_PREFIX = /^\[ACTION_PLAN:([a-z_]+)\]\n?/;

/** Left → right on the mockup scale (At Risk → Above & Beyond). */
const SCALE_ORDER: GoalRatingColor[] = [...RATING_ORDER].reverse();

const textareaClass =
  "w-full resize-y rounded-[10px] border border-[#e8e4f0] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/55 focus:border-brand-400";
const textareaFieldClass = `mt-2 ${textareaClass}`;

function unpackPlan(raw: string | undefined): {
  choice: ActionPlanId | null;
  elaborate: string;
} {
  const text = raw ?? "";
  const match = ACTION_PREFIX.exec(text);
  if (!match) return { choice: null, elaborate: text };
  const id = match[1] as ActionPlanId;
  const valid = ACTION_PLAN_OPTIONS.some((o) => o.id === id);
  return {
    choice: valid ? id : null,
    elaborate: text.slice(match[0].length),
  };
}

function packPlan(choice: ActionPlanId | null, elaborate: string) {
  const body = elaborate.trim();
  if (!choice) return body;
  return `[ACTION_PLAN:${choice}]\n${body}`;
}

function MetaCell({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0 border-b border-[#f0ecf6] pb-2.5 last:border-b-0 last:pb-0">
      <p className="m-0 text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="m-0 mt-0.5 text-[13.5px] font-semibold leading-snug text-[#2e1065]">
        {value}
      </p>
    </div>
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
    >
      {children}
    </span>
  );
}

function OverallRatingScale({
  value,
  onChange,
  disabled,
}: {
  value: GoalRatingColor;
  onChange: (next: GoalRatingColor) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Overall rating"
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-2">
        {SCALE_ORDER.map((rating) => {
          const copy = getGoalRatingCopy(rating);
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              title={copy.mentorDescription}
              onClick={() => onChange(rating)}
              className={[
                "flex min-h-[3.75rem] flex-col items-center justify-center gap-1.5 rounded-[10px] border px-2 py-2 transition disabled:opacity-50",
                selected
                  ? "shadow-sm"
                  : "border-[#ebe6f4] bg-white hover:border-brand-200 hover:bg-[#faf8ff]",
              ].join(" ")}
              style={
                selected
                  ? {
                      borderColor: copy.color,
                      background: copy.background,
                    }
                  : undefined
              }
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[2px] bg-white"
                style={{
                  borderColor: copy.color,
                  background: selected ? copy.color : "#fff",
                }}
              >
                {selected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              <span
                className="text-center text-[11.5px] font-semibold leading-tight"
                style={{ color: copy.color }}
              >
                {copy.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Vertical list: strongest at top (Above & Beyond → At Risk). */
const COMPETENCY_RATING_ORDER: GoalRatingColor[] = [...SCALE_ORDER].reverse();

function CompetencyRatingRadios({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: GoalRatingColor;
  onChange: (next: GoalRatingColor) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex min-w-[120px] flex-col gap-1">
      {COMPETENCY_RATING_ORDER.map((rating) => {
        const copy = getGoalRatingCopy(rating);
        const selected = value === rating;
        return (
          <label
            key={rating}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-[8px] px-1.5 py-1 text-[12px] font-semibold transition",
              selected ? "" : "hover:bg-[#faf7ff]",
            ].join(" ")}
            style={
              selected
                ? { background: copy.background, color: copy.color }
                : undefined
            }
          >
            <input
              type="radio"
              className="accent-current"
              style={{ accentColor: copy.color }}
              name={name}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(rating)}
            />
            <span style={{ color: copy.color }}>{copy.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="m-0 text-[12px] italic text-ink-muted">—</p>
    );
  }
  return (
    <ul className="m-0 list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-[#3b2760]">
      {items.map((item) => (
        <li key={item.slice(0, 64)}>{item}</li>
      ))}
    </ul>
  );
}

function CompetencyIcon({ index }: { index: number }) {
  const paths = [
    "M4 18V10M9 18V6M14 18v-4M19 18V8",
    "M9 18h6M10 21h4M12 3a5 5 0 0 0-3 9c.6.5 1 1.4 1 2.2V15h4v-.8c0-.8.4-1.7 1-2.2A5 5 0 0 0 12 3z",
    "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    "M16 19v-1.5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3V19M17 11a3 3 0 1 0 0-6M13.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z",
    "M3 17l6-6 4 4 7-7M14 8h6v6",
  ];
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-50 text-brand-700"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[index % paths.length]!} />
      </svg>
    </span>
  );
}

export function ProgressUpdateForm({
  mentorshipId,
  menteeId,
  menteeName,
  cycleLabel,
  requiresChairApproval,
  isUpdate = false,
  rubric,
  bandReference,
  employee,
  initialOverallRating,
  initialOverallComments,
  initialStrengths,
  initialAreas,
  initialPlan,
  initialGoals,
  reviewId,
}: {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  cycleLabel: string;
  requiresChairApproval: boolean;
  isUpdate?: boolean;
  rubric: ProgressRubricContext;
  bandReference?: Array<{ number: number; title: string; bullets: string[] }>;
  employee?: ProgressEmployeeProfile;
  initialOverallRating?: GoalRatingColor | null;
  initialOverallComments?: string;
  initialStrengths?: string;
  initialAreas?: string;
  initialPlan?: string;
  initialGoals: ProgressGoalDraft[];
  /** Persist into this specific review document when set. */
  reviewId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unpacked = useMemo(() => unpackPlan(initialPlan), [initialPlan]);

  const [overallRating, setOverallRating] = useState<GoalRatingColor>(
    initialOverallRating ?? "ACHIEVED",
  );
  const [overallComments, setOverallComments] = useState(
    initialOverallComments ?? "",
  );
  const [strengths, setStrengths] = useState(initialStrengths ?? "");
  const [areas, setAreas] = useState(initialAreas ?? "");
  const [actionChoice, setActionChoice] = useState<ActionPlanId | null>(
    unpacked.choice,
  );
  const [planElaborate, setPlanElaborate] = useState(unpacked.elaborate);
  const [goals, setGoals] = useState<ProgressGoalDraft[]>(initialGoals);

  const profile: ProgressEmployeeProfile = employee ?? {
    name: menteeName,
    role: rubric.roleLabel,
    department: null,
    gradeLabel: rubric.roleSubtitle
      ? `${rubric.roleLabel} (${rubric.roleSubtitle})`
      : rubric.roleLabel,
    hometown: null,
    location: null,
    hireDateLabel: null,
    mentorDisplay: null,
    chairDisplay: null,
  };

  const period = cycleLabel.includes("Review")
    ? cycleLabel
    : `${cycleLabel} Review`;
  const firstName = profile.name.split(" ")[0] || profile.name;

  function updateGoal(goalId: string, patch: Partial<ProgressGoalDraft>) {
    setGoals((prev) =>
      prev.map((g) => (g.goalId === goalId ? { ...g, ...patch } : g)),
    );
  }

  function submit(mode: "send" | "draft") {
    if (mode === "send") {
      if (!overallComments.trim()) {
        setError("Add overall comments.");
        return;
      }
      if (!strengths.trim()) {
        setError("List at least one strength.");
        return;
      }
      if (!areas.trim()) {
        setError("List at least one area for development.");
        return;
      }
      if (!actionChoice && !planElaborate.trim()) {
        setError("Choose an action plan and add a short elaboration.");
        return;
      }
      if (!planElaborate.trim()) {
        setError("Please elaborate on the action plan.");
        return;
      }
    }
    setError(null);

    const planOfAction = packPlan(actionChoice, planElaborate);
    startTransition(async () => {
      try {
        const result = await submitMonthlyProgressUpdate({
          mentorshipId,
          menteeId,
          reviewId: reviewId ?? undefined,
          overallRating,
          overallComments: overallComments.trim() || "(Draft)",
          strengths: strengths.trim() || "(Draft)",
          areasForDevelopment: areas.trim() || "(Draft)",
          planOfAction: planOfAction.trim() || "(Draft)",
          goals: goals.map((g) => ({
            goalId: g.goalId,
            source: g.source,
            rating: g.rating || overallRating,
            collaborateWith: g.collaborateWith,
            objective: g.objective.trim() || planElaborate.trim() || "(Draft)",
            actionItems: g.actionItems,
          })),
          saveAsDraft: mode === "draft",
        });
        if (mode === "draft") {
          router.refresh();
          setError(null);
          return;
        }
        router.push(
          `/mentorship/people/${menteeId}?section=progress${
            result.reviewId ? `&reviewId=${encodeURIComponent(result.reviewId)}` : ""
          }${
            result.released ? "&progressSent=1" : "&progressPending=1"
          }`,
        );
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save. Try again.",
        );
      }
    });
  }

  const primaryCta = requiresChairApproval
    ? "Send Review to Chair"
    : isUpdate
      ? "Send updated review"
      : "Send review to mentee";

  const cardClass =
    "rounded-[14px] border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]";

  return (
    <div className="flex w-full flex-col gap-5">
      <header>
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.03em] text-[#2e1065]">
          Performance Review
        </h2>
        <p className="m-0 mt-1 text-[14px] text-ink-muted">{period}</p>
      </header>

      {/* Employee + Review team */}
      <div className={`${cardClass} grid gap-0 lg:grid-cols-[1.35fr_1fr]`}>
        <div className="border-b border-[#e8e4f0] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-2.5">
            <SectionIcon>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </SectionIcon>
            <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">
              Person information
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <MetaCell label="Name" value={profile.name} />
            <MetaCell label="Hometown" value={profile.hometown} />
            <MetaCell label="Role" value={profile.role} />
            <MetaCell label="Location" value={profile.location} />
            <MetaCell label="Department" value={profile.department} />
            <MetaCell label="Hire Date" value={profile.hireDateLabel} />
            <MetaCell label="Grade / Level" value={profile.gradeLabel} />
            <MetaCell label="Review Period" value={period} />
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <SectionIcon>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
            </SectionIcon>
            <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">Review Team</h3>
          </div>
          <div className="flex flex-col gap-3">
            <MetaCell
              label="Mentor"
              value={profile.mentorDisplay ?? "Not assigned"}
            />
            <MetaCell
              label="Role Chair"
              value={profile.chairDisplay ?? "Not assigned"}
            />
          </div>
        </div>
      </div>

      {/* Rating compact on the left; Action Plan fills the rest of the row */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className={`${cardClass} flex w-full shrink-0 flex-col gap-3 p-5 sm:p-6 lg:w-[17.5rem]`}>
          <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">
            Overall Rating
          </h3>
          <OverallRatingScale
            value={overallRating}
            disabled={pending}
            onChange={(value) => {
              setOverallRating(value);
              setGoals((prev) => prev.map((g) => ({ ...g, rating: value })));
            }}
          />
        </div>

        <div className={`${cardClass} flex min-w-0 flex-1 flex-col gap-3.5 p-5 sm:p-6`}>
          <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">Action Plan</h3>
          <div className="grid items-stretch gap-5 md:grid-cols-[1.15fr_1fr] lg:gap-6">
            <div
              className="flex flex-col gap-3"
              role="radiogroup"
              aria-label="Action plan"
            >
              {ACTION_PLAN_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-snug text-[#3b2760]"
                >
                  <input
                    type="radio"
                    className="mt-1 accent-brand-600"
                    name="action-plan"
                    checked={actionChoice === opt.id}
                    disabled={pending}
                    onChange={() => setActionChoice(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <label className="flex min-h-0 flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[#2e1065]">
                Please elaborate
              </span>
              <textarea
                className={`${textareaClass} min-h-[10.5rem] flex-1`}
                rows={6}
                value={planElaborate}
                disabled={pending}
                onChange={(e) => setPlanElaborate(e.target.value)}
                placeholder="Enter details, timeline, or next steps…"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Comments / Strengths / Development */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${cardClass} flex flex-col p-5`}>
          <div className="mb-1 flex items-center gap-2">
            <SectionIcon>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
              </svg>
            </SectionIcon>
            <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">
              Overall Comments
            </h3>
          </div>
          <textarea
            className={textareaFieldClass}
            rows={6}
            value={overallComments}
            disabled={pending}
            onChange={(e) => setOverallComments(e.target.value)}
            placeholder="Summarize their contributions this cycle…"
          />
        </div>
        <div className={`${cardClass} flex flex-col p-5`}>
          <div className="mb-1 flex items-center gap-2">
            <SectionIcon>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" strokeLinejoin="round" />
              </svg>
            </SectionIcon>
            <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">Strengths</h3>
          </div>
          <textarea
            className={textareaFieldClass}
            rows={6}
            value={strengths}
            disabled={pending}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder={"• Strength one\n• Strength two"}
          />
        </div>
        <div className={`${cardClass} flex flex-col p-5`}>
          <div className="mb-1 flex items-center gap-2">
            <SectionIcon>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 17l6-6 4 4 7-7M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SectionIcon>
            <h3 className="m-0 text-[14px] font-bold text-[#2e1065]">
              Areas of Development
            </h3>
          </div>
          <textarea
            className={textareaFieldClass}
            rows={6}
            value={areas}
            disabled={pending}
            onChange={(e) => setAreas(e.target.value)}
            placeholder={"• Development area one\n• Development area two"}
          />
        </div>
      </div>

      {/* Competency table */}
      {goals.length > 0 ? (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f5f0ff]">
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      Competency
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                      What we evaluate
                    </span>
                  </th>
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      {goals[0]?.currentExpectationLabel ??
                        "Current level expectations"}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                      What&apos;s expected for this role
                    </span>
                  </th>
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      {goals[0]?.nextExpectationLabel ??
                        "Next level expectations"}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                      What&apos;s expected for promotion
                    </span>
                  </th>
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      Specific examples
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">
                      For this role
                    </span>
                  </th>
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      Rating
                    </span>
                  </th>
                  <th className="border-b border-[#e8e4f0] px-4 py-3.5 align-bottom">
                    <span className="block text-[12px] font-bold text-[#2e1065]">
                      Comments
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g, index) => {
                  const current =
                    g.currentExpectationBullets ?? g.expectationBullets ?? [];
                  const next = g.nextExpectationBullets ?? [];
                  return (
                    <tr key={g.goalId} className="align-top">
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <div className="flex gap-3">
                          <CompetencyIcon index={index} />
                          <div>
                            <p className="m-0 text-[13px] font-bold text-[#2e1065]">
                              {index + 1}. {g.title}
                            </p>
                            {g.oneLiner ? (
                              <p className="m-0 mt-1 text-[12px] leading-snug text-ink-muted">
                                {g.oneLiner}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <BulletList items={current} />
                      </td>
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <BulletList items={next} />
                      </td>
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <textarea
                          className="min-h-[120px] w-full min-w-[150px] resize-y rounded-[8px] border border-[#e8e4f0] bg-[#faf8ff] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand-400"
                          value={g.objective}
                          disabled={pending}
                          onChange={(e) =>
                            updateGoal(g.goalId, { objective: e.target.value })
                          }
                          placeholder="Specific examples this cycle…"
                        />
                      </td>
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <CompetencyRatingRadios
                          name={`rating-${g.goalId}`}
                          value={g.rating}
                          disabled={pending}
                          onChange={(rating) =>
                            updateGoal(g.goalId, { rating })
                          }
                        />
                      </td>
                      <td className="border-b border-[#eeeaf5] px-4 py-4">
                        <textarea
                          className="min-h-[120px] w-full min-w-[140px] resize-y rounded-[8px] border border-[#e8e4f0] bg-[#faf8ff] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand-400"
                          value={g.actionItems}
                          disabled={pending}
                          onChange={(e) =>
                            updateGoal(g.goalId, {
                              actionItems: e.target.value,
                            })
                          }
                          placeholder="Feedback…"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CardV2 padding="lg" className={cardClass}>
          <p className="m-0 text-[13.5px] text-ink-muted">
            No competencies loaded yet — complete the summary sections above.
          </p>
          {bandReference && bandReference.length > 0 ? (
            <details className="mt-3 rounded-[12px] border border-[#e8e4f0]">
              <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-ink">
                {rubric.roleLabel} expectations
              </summary>
              <div className="flex flex-col gap-3 border-t border-[#e8e4f0] px-4 py-3">
                {bandReference.map((row) => (
                  <div key={row.title}>
                    <p className="m-0 text-[13px] font-bold text-ink">
                      {row.number}. {row.title}
                    </p>
                    <BulletList items={row.bullets} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </CardV2>
      )}

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => submit("send")}
            loading={pending}
          >
            {primaryCta}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("draft")}
            className="h-9.5 rounded-[9px] border border-brand-300 bg-white px-4 text-[13.5px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            Save as Draft
          </button>
        </div>
        <p className="m-0 text-[12px] text-ink-muted">
          {firstName} will see these ratings and your comments
          {requiresChairApproval ? " after chair approval" : ""}.
        </p>
      </div>
    </div>
  );
}
