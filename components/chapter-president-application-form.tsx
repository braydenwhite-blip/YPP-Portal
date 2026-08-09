"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitChapterPresidentApplication } from "@/lib/chapter-president-application-actions";

type Chapter = {
  id: string;
  name: string;
};

interface CPApplicationFormProps {
  chapters: Chapter[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending} style={{ width: "100%" }}>
      {pending ? "Submitting..." : "Submit Application"}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0 12px" }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {children}
      </p>
    </>
  );
}

function wordCount(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

const APPLYING_WITH_OPTIONS = ["Individually", "With another candidate"] as const;

export default function ChapterPresidentApplicationForm({ chapters }: CPApplicationFormProps) {
  const [state, formAction] = useFormState(submitChapterPresidentApplication, {
    status: "idle" as const,
    message: "",
  });

  const [whyCP, setWhyCP] = useState("");
  const [applyingWith, setApplyingWith] = useState<string>("Individually");

  const whyCPWordCount = wordCount(whyCP);
  const whyCPOverLimit = whyCPWordCount > 150;

  if (state.status === "success") {
    return (
      <div style={{ padding: 24, background: "#f0fdf4", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: "0 0 8px" }}>Application Submitted</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          {"You'll receive email updates as your application progresses."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">Apply for Chapter President</div>

      {state.status === "error" && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {state.message}
        </div>
      )}

      <form action={formAction} className="form-grid">

        {/* — Basic Information — */}
        <SectionHeader>Basic Information</SectionHeader>

        <div className="form-row">
          <label>Full Name <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="preferredFirstName" placeholder="Your full name" required />
        </div>

        <div className="form-row">
          <label>Phone Number <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="phoneNumber" type="tel" placeholder="(555) 123-4567" required />
        </div>

        <div className="form-row">
          <label>School and Current Grade <span style={{ color: "#dc2626" }}>*</span></label>
          <div style={{ display: "flex", gap: 10 }}>
            <input className="input" name="schoolName" placeholder="School name" required style={{ flex: 2 }} />
            <select className="input" name="grade" required defaultValue="" style={{ flex: 1 }}>
              <option value="" disabled>Grade</option>
              <option value="9th grade">9th grade</option>
              <option value="10th grade">10th grade</option>
              <option value="11th grade">11th grade</option>
              <option value="12th grade">12th grade</option>
              <option value="Gap year / other">Gap year / other</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>City and State <span style={{ color: "#dc2626" }}>*</span></label>
          <div style={{ display: "flex", gap: 10 }}>
            <input className="input" name="city" placeholder="City" required style={{ flex: 1 }} />
            <input className="input" name="stateProvince" placeholder="State" required style={{ flex: 1 }} />
          </div>
        </div>

        <div className="form-row">
          <label>What area would you like to lead a chapter in? <span style={{ color: "#dc2626" }}>*</span></label>
          <select className="input" name="chapterId" defaultValue="" required>
            <option value="" disabled>Select a chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Are you applying individually or with another candidate? <span style={{ color: "#dc2626" }}>*</span></label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {APPLYING_WITH_OPTIONS.map((opt) => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="radio"
                  name="applyingWith"
                  value={opt}
                  checked={applyingWith === opt}
                  onChange={() => setApplyingWith(opt)}
                  required
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {applyingWith === "With another candidate" && (
          <div className="form-row">
            <label>Co-candidate&apos;s name <span style={{ color: "#dc2626" }}>*</span></label>
            <input className="input" name="coCandidateName" placeholder="Their full name" required />
          </div>
        )}

        {/* — Interest and Initial Plan — */}
        <SectionHeader>Interest and Initial Plan</SectionHeader>

        <div className="form-row">
          <label>Why do you want to become a YPP Chapter President? <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>Max 150 words</p>
          <textarea
            name="whyChapterPresident"
            className="input"
            rows={5}
            required
            value={whyCP}
            onChange={(e) => setWhyCP(e.target.value)}
          />
          <span style={{ fontSize: 11, color: whyCPOverLimit ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {whyCPWordCount} / 150 words{whyCPOverLimit && " — over limit"}
          </span>
        </div>

        {/* — Experience & Follow Through — */}
        <SectionHeader>Experience &amp; Follow Through</SectionHeader>

        <div className="form-row">
          <label>How many hours can you consistently commit each week? <span style={{ color: "#dc2626" }}>*</span></label>
          <select className="input" name="hoursPerWeek" required defaultValue="">
            <option value="" disabled>Select one</option>
            <option value="1">Fewer than 2 hours</option>
            <option value="2">2-3 hours</option>
            <option value="4">3-5 hours</option>
            <option value="6">More than 5 hours</option>
          </select>
        </div>

        <div className="form-row">
          <label>Are there any major commitments that could affect your availability?</label>
          <textarea className="input" name="availabilityConflicts" rows={3} placeholder="Optional — sports, jobs, other commitments, etc." />
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}