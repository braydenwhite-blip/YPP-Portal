"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkshopTemplate,
  updateWorkshopTemplate,
} from "@/lib/workshop-proposal-actions";
import { difficultyLabel, templateStatusLabel } from "@/lib/workshop-proposal-constants";
import type {
  WorkshopProposalDifficulty,
  WorkshopProposalTemplateStatus,
} from "@prisma/client";

type TemplateFormProps = {
  mode: "create" | "edit";
  initial?: {
    id: string;
    title: string;
    category: string;
    targetAgeRange: string;
    estimatedMinutes: number;
    description: string;
    learningObjectives: string[];
    activityPlan: string;
    materials: string[];
    difficulty: WorkshopProposalDifficulty;
    tags: string[];
    status: WorkshopProposalTemplateStatus;
  };
};

const DIFFICULTIES: WorkshopProposalDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const STATUSES: WorkshopProposalTemplateStatus[] = ["DRAFT", "APPROVED", "ARCHIVED"];

export function TemplateForm({ mode, initial }: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createWorkshopTemplate(formData);
        } else if (initial) {
          formData.set("id", initial.id);
          await updateWorkshopTemplate(formData);
        }
        router.push("/admin/workshop-library");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Save failed.";
        alert(message);
      }
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ display: "grid", gap: 14 }}>
      <Field label="Title">
        <input
          name="title"
          className="input"
          required
          defaultValue={initial?.title ?? ""}
          placeholder="Build a Paper-Bridge"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Category">
          <input
            name="category"
            className="input"
            required
            defaultValue={initial?.category ?? ""}
            placeholder="STEM"
          />
        </Field>
        <Field label="Target age range">
          <input
            name="targetAgeRange"
            className="input"
            required
            defaultValue={initial?.targetAgeRange ?? ""}
            placeholder="Grades 4–6"
          />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Length (minutes)">
          <input
            name="estimatedMinutes"
            type="number"
            min={15}
            max={240}
            className="input"
            required
            defaultValue={initial?.estimatedMinutes ?? 60}
          />
        </Field>
        <Field label="Difficulty">
          <select
            name="difficulty"
            className="input"
            defaultValue={initial?.difficulty ?? "BEGINNER"}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {difficultyLabel(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            name="status"
            className="input"
            defaultValue={initial?.status ?? "DRAFT"}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {templateStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" hint="One short paragraph applicants will skim in the library.">
        <textarea
          name="description"
          rows={3}
          className="input"
          required
          defaultValue={initial?.description ?? ""}
        />
      </Field>
      <Field label="Learning objectives" hint="One per line.">
        <textarea
          name="learningObjectives"
          rows={4}
          className="input"
          defaultValue={(initial?.learningObjectives ?? []).join("\n")}
        />
      </Field>
      <Field label="Activity plan" hint="Step-by-step facilitation guide. Markdown OK.">
        <textarea
          name="activityPlan"
          rows={10}
          className="input"
          required
          defaultValue={initial?.activityPlan ?? ""}
        />
      </Field>
      <Field label="Materials" hint="One item per line.">
        <textarea
          name="materials"
          rows={4}
          className="input"
          defaultValue={(initial?.materials ?? []).join("\n")}
        />
      </Field>
      <Field label="Tags" hint="One per line. Used by the applicant library search.">
        <textarea
          name="tags"
          rows={2}
          className="input"
          defaultValue={(initial?.tags ?? []).join("\n")}
        />
      </Field>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 4,
        }}
      >
        <button type="submit" className="button" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create workshop" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {hint ? (
        <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}
