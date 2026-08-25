"use client";

// Public student/family interest form. No login required — this is the entry
// point for families who don't have a portal account yet. Submits to
// submitStudentLead and shows a plain confirmation on success.

import { useState, useTransition } from "react";

import { CardV2, Button } from "@/components/ui-v2";
import { submitStudentLead } from "@/lib/student-lead-actions";

type FormState = {
  studentName: string;
  age: string;
  grade: string;
  school: string;
  studentEmail: string;
  parentName: string;
  parentEmail: string;
  allergiesNotes: string;
};

const EMPTY: FormState = {
  studentName: "",
  age: "",
  grade: "",
  school: "",
  studentEmail: "",
  parentName: "",
  parentEmail: "",
  allergiesNotes: "",
};

export function StudentInterestForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitStudentLead({
          studentName: form.studentName,
          age: Number(form.age),
          grade: form.grade,
          school: form.school,
          studentEmail: form.studentEmail,
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          allergiesNotes: form.allergiesNotes || undefined,
        });
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong submitting. Please try again.");
      }
    });
  }

  if (submitted) {
    return (
      <CardV2 className="border-complete-200 bg-complete-50/60">
        <h2 className="m-0 text-[16px] font-bold text-ink">Thanks — we got it</h2>
        <p className="m-0 mt-1.5 text-[13.5px] text-ink-muted">
          Someone from Youth Passion Project will follow up by email soon.
        </p>
      </CardV2>
    );
  }

  return (
    <CardV2 className="flex flex-col gap-3">
      <Field label="Student name" value={form.studentName} onChange={(v) => set("studentName", v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" value={form.age} onChange={(v) => set("age", v)} type="number" />
        <Field label="Grade" value={form.grade} onChange={(v) => set("grade", v)} />
      </div>
      <Field label="School" value={form.school} onChange={(v) => set("school", v)} />
      <Field label="Student email" value={form.studentEmail} onChange={(v) => set("studentEmail", v)} type="email" />
      <Field label="Parent/guardian name" value={form.parentName} onChange={(v) => set("parentName", v)} />
      <Field label="Parent/guardian email" value={form.parentEmail} onChange={(v) => set("parentEmail", v)} type="email" />
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
        Allergies or accommodations (optional)
        <textarea
          value={form.allergiesNotes}
          onChange={(e) => set("allergiesNotes", e.target.value)}
          rows={2}
          className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        {error && <span className="text-[12.5px] font-semibold text-blocked-700">{error}</span>}
        <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending} className="ml-auto">
          Submit
        </Button>
      </div>
    </CardV2>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400"
      />
    </label>
  );
}