"use client";

import { useState } from "react";
import {
  completeClassAndIssueCertificates,
  upsertInstructorStudentFeedback,
  releaseInstructorFeedback,
  upsertClassAnnouncement,
  respondToAttendanceReview,
} from "@/lib/session8/instructor-actions";

export function ClassCompletionAction({ offeringId, offeringEnded, alreadyCompleted }: { offeringId: string; offeringEnded: boolean; alreadyCompleted: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pending, setPending] = useState(false);

  if (alreadyCompleted) {
    return <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">This class is marked complete.</p>;
  }
  if (!offeringEnded) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Completion becomes available after the last scheduled session date.</p>;
  }

  async function run() {
    setPending(true);
    const fd = new FormData();
    fd.set("offeringId", offeringId);
    const r = await completeClassAndIssueCertificates(fd);
    setResult(r);
    setPending(false);
    setConfirming(false);
  }

  return (
    <div className="space-y-2">
      {result && result.ok && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          Marked {result.completedCount} enrollment(s) complete. {result.certificatesIssued} certificate(s) issued.
          {result.certificatesUnavailable && <p className="mt-1 text-amber-800">Certificates unavailable — no active template.</p>}
        </div>
      )}
      {result && !result.ok && <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">{result.error}</div>}
      {!result?.ok && (
        confirming ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>This marks all enrolled students complete and issues certificates where available. Continue?</p>
            <div className="mt-2 flex gap-2">
              <button disabled={pending} onClick={run} className="min-h-11 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                {pending ? "Completing…" : "Yes, complete class"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
            Complete class & issue certificates
          </button>
        )
      )}
    </div>
  );
}

type FeedbackRow = { id: string; studentId: string; body: string; strengths: string | null; growthAreas: string | null; releasedToFamilyAt: string | Date | null };

export function StudentFeedbackPanel({ offeringId, students, feedback }: { offeringId: string; students: { id: string; name: string | null }[]; feedback: FeedbackRow[] }) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const byStudent = new Map(feedback.map((f) => [f.studentId, f]));

  return (
    <div className="space-y-3">
      {students.map((s) => {
        const existing = byStudent.get(s.id);
        return (
          <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{s.name ?? "Student"}</p>
                {existing ? (
                  <p className="text-sm text-slate-500">{existing.releasedToFamilyAt ? "Feedback released to family" : "Draft not yet released"}</p>
                ) : (
                  <p className="text-sm text-slate-500">No feedback written yet.</p>
                )}
              </div>
              <button type="button" onClick={() => setOpenFor(openFor === s.id ? null : s.id)} className="min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                {openFor === s.id ? "Close" : existing ? "Edit feedback" : "Write feedback"}
              </button>
            </div>
            {openFor === s.id && (
              <form action={upsertInstructorStudentFeedback} className="mt-3 space-y-2">
                <input type="hidden" name="offeringId" value={offeringId} />
                <input type="hidden" name="studentId" value={s.id} />
                <label className="block text-sm font-semibold" htmlFor={`body-${s.id}`}>Feedback</label>
                <textarea id={`body-${s.id}`} name="body" defaultValue={existing?.body ?? ""} required className="w-full rounded-xl border p-3 text-sm" />
                <label className="block text-sm font-semibold" htmlFor={`strengths-${s.id}`}>Strengths (optional)</label>
                <textarea id={`strengths-${s.id}`} name="strengths" defaultValue={existing?.strengths ?? ""} className="w-full rounded-xl border p-3 text-sm" />
                <label className="block text-sm font-semibold" htmlFor={`growth-${s.id}`}>Growth areas (optional)</label>
                <textarea id={`growth-${s.id}`} name="growthAreas" defaultValue={existing?.growthAreas ?? ""} className="w-full rounded-xl border p-3 text-sm" />
                <button className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Save feedback</button>
              </form>
            )}
            {existing && !existing.releasedToFamilyAt && (
              <form action={releaseInstructorFeedback} className="mt-2">
                <input type="hidden" name="feedbackId" value={existing.id} />
                <p className="mb-1 text-xs font-semibold text-amber-800">This will be visible to the student's family.</p>
                <button className="min-h-11 rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                  Release to family
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AnnouncementComposer({ offeringId }: { offeringId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ published: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    formData.set("offeringId", offeringId);
    const r = await upsertClassAnnouncement(formData);
    setResult(r);
    setPending(false);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      {result && (
        <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-900">
          {result.published ? "Announcement published." : "Sent for approval."}
        </p>
      )}
      {open ? (
        <form action={submit} className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="ann-title">Title</label>
          <input id="ann-title" name="title" required className="w-full rounded-xl border p-3 text-sm" />
          <label className="block text-sm font-semibold" htmlFor="ann-body">Message</label>
          <textarea id="ann-body" name="body" required className="w-full rounded-xl border p-3 text-sm" />
          <label className="block text-sm font-semibold" htmlFor="ann-type">Type</label>
          <select id="ann-type" name="announcementType" className="w-full rounded-xl border p-3 text-sm">
            <option value="ROUTINE">Routine (publishes immediately)</option>
            <option value="SCHEDULE_CHANGE">Schedule change (needs approval)</option>
            <option value="URGENT">Urgent (needs approval)</option>
            <option value="GENERAL">General (needs approval)</option>
          </select>
          <div className="flex gap-2">
            <button disabled={pending} className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Send"}</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
          New announcement
        </button>
      )}
    </div>
  );
}

export function AttendanceReviewResponse({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    formData.set("requestId", requestId);
    await respondToAttendanceReview(formData);
    setSent(true);
    setOpen(false);
  }

  if (sent) return <p className="text-xs text-emerald-700">Response sent to family.</p>;
  return open ? (
    <form action={submit} className="mt-2 space-y-2">
      <textarea name="body" required placeholder="Response visible to the family" className="w-full rounded-xl border p-2 text-sm" />
      <div className="flex gap-2">
        <button className="min-h-11 rounded-full bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white">Send response</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border px-3 py-1.5 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-1 min-h-11 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50">
      Respond
    </button>
  );
}
