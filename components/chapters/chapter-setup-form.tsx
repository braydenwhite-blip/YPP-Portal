"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChapterSetup } from "@/lib/chapters/actions";

const SCHOOL_TYPES = ["", "PUBLIC", "PRIVATE", "CHARTER", "HOMESCHOOL", "COLLEGE", "OTHER"] as const;
const SCHOOL_TYPE_LABELS: Record<string, string> = {
  "": "—",
  PUBLIC: "Public",
  PRIVATE: "Private",
  CHARTER: "Charter",
  HOMESCHOOL: "Homeschool",
  COLLEGE: "College",
  OTHER: "Other",
};

export type ChapterSetupInitial = {
  chapterId: string;
  city: string;
  state: string;
  schoolType: string;
  partnerSchool: string;
  facultyAdvisorName: string;
  facultyAdvisorEmail: string;
  foundingTeamNotes: string;
  recruitmentGoal: string;
  supportNeeded: string;
  launchTargetDate: string; // yyyy-mm-dd
  expectedFirstMeetingAt: string; // yyyy-mm-dd
};

const inputCls = "rounded-lg border border-line px-3 py-2 text-[14px] font-normal";
const labelCls = "flex flex-col gap-1 text-[13px] font-medium text-ink";

export function ChapterSetupForm({ initial }: { initial: ChapterSetupInitial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  function set<K extends keyof ChapterSetupInitial>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }

  function save() {
    setStatus("idle");
    startTransition(async () => {
      try {
        await updateChapterSetup({
          chapterId: initial.chapterId,
          city: form.city,
          state: form.state,
          schoolType: form.schoolType ? form.schoolType : null,
          partnerSchool: form.partnerSchool,
          facultyAdvisorName: form.facultyAdvisorName,
          facultyAdvisorEmail: form.facultyAdvisorEmail,
          foundingTeamNotes: form.foundingTeamNotes,
          recruitmentGoal: form.recruitmentGoal ? Number(form.recruitmentGoal) : null,
          supportNeeded: form.supportNeeded,
          launchTargetDate: form.launchTargetDate || null,
          expectedFirstMeetingAt: form.expectedFirstMeetingAt || null,
        });
        setStatus("saved");
        setMessage("Saved.");
        router.refresh();
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Could not save chapter setup.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          City
          <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className={labelCls}>
          State
          <input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} />
        </label>
        <label className={labelCls}>
          School
          <input className={inputCls} value={form.partnerSchool} onChange={(e) => set("partnerSchool", e.target.value)} />
        </label>
        <label className={labelCls}>
          School type
          <select className={inputCls} value={form.schoolType} onChange={(e) => set("schoolType", e.target.value)}>
            {SCHOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHOOL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Faculty advisor
          <input className={inputCls} value={form.facultyAdvisorName} onChange={(e) => set("facultyAdvisorName", e.target.value)} />
        </label>
        <label className={labelCls}>
          Advisor email
          <input className={inputCls} value={form.facultyAdvisorEmail} onChange={(e) => set("facultyAdvisorEmail", e.target.value)} />
        </label>
        <label className={labelCls}>
          Recruitment goal (members)
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.recruitmentGoal}
            onChange={(e) => set("recruitmentGoal", e.target.value)}
          />
        </label>
        <label className={labelCls}>
          Launch target date
          <input type="date" className={inputCls} value={form.launchTargetDate} onChange={(e) => set("launchTargetDate", e.target.value)} />
        </label>
        <label className={labelCls}>
          Expected first meeting
          <input type="date" className={inputCls} value={form.expectedFirstMeetingAt} onChange={(e) => set("expectedFirstMeetingAt", e.target.value)} />
        </label>
      </div>
      <label className={labelCls}>
        Founding team
        <textarea
          rows={2}
          className={inputCls}
          placeholder="Who's on the founding team? (names / roles)"
          value={form.foundingTeamNotes}
          onChange={(e) => set("foundingTeamNotes", e.target.value)}
        />
      </label>
      <label className={labelCls}>
        Support needed from national
        <textarea
          rows={2}
          className={inputCls}
          value={form.supportNeeded}
          onChange={(e) => set("supportNeeded", e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="self-start rounded-lg bg-brand-600 px-4 py-2 text-[14px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save setup"}
        </button>
        {status !== "idle" && (
          <span className={`text-[12.5px] ${status === "error" ? "text-blocked-700" : "text-complete-700"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
