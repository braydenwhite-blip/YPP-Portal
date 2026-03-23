"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitChapterPresidentApplication } from "@/lib/chapter-president-application-actions";
import FileUpload from "./file-upload";

type FormField = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string | null;
};

type Chapter = {
  id: string;
  name: string;
};

interface CPApplicationFormProps {
  chapters: Chapter[];
  customFields?: FormField[];
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

export default function ChapterPresidentApplicationForm({
  chapters,
  customFields = [],
}: CPApplicationFormProps) {
  const [state, formAction] = useFormState(submitChapterPresidentApplication, {
    status: "idle" as const,
    message: "",
  });

  const [leadershipExperience, setLeadershipExperience] = useState("");
  const [chapterVision, setChapterVision] = useState("");
  const [whyCP, setWhyCP] = useState("");
  const [recruitmentPlan, setRecruitmentPlan] = useState("");
  const [launchPlan, setLaunchPlan] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [country, setCountry] = useState("United States");

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

      <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
        <strong>Note:</strong> This position requires an interview. After submitting, a reviewer will review your application and schedule an interview.
      </div>

      {state.status === "error" && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {state.message}
        </div>
      )}

      <form action={formAction} className="form-grid">

        {/* ── Section 1: Personal Information ── */}
        <SectionHeader>Section 1 — Personal Information</SectionHeader>

        <div className="form-row">
          <label>Full Legal Name (First, Middle, and Last) <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="legalName" placeholder="e.g. Jane Marie Smith" required />
        </div>

        <div className="form-row">
          <label>Preferred First Name <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="preferredFirstName" placeholder="What would you like us to call you?" required />
        </div>

        <div className="form-row">
          <label>Phone Number (optional)</label>
          <input className="input" name="phoneNumber" type="tel" placeholder="(555) 123-4567" />
        </div>

        <div className="form-row">
          <label>Date of Birth (optional)</label>
          <input className="input" name="dateOfBirth" type="date" />
        </div>

        <div className="form-row">
          <label>How did you hear about YPP? (optional)</label>
          <select className="input" name="hearAboutYPP" defaultValue="">
            <option value="">Select one</option>
            <option value="Social media">Social media</option>
            <option value="Friend or classmate">Friend or classmate</option>
            <option value="Teacher or counselor">Teacher or counselor</option>
            <option value="School announcement">School announcement</option>
            <option value="YPP website">YPP website</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* ── Section 2: Location ── */}
        <SectionHeader>Section 2 — Location</SectionHeader>

        <div className="form-row">
          <label>What town/city do you live in? <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="city" placeholder="e.g. Austin" required />
        </div>

        <div className="form-row">
          <label>What state/province do you live in? <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="stateProvince" placeholder="e.g. Texas" required />
        </div>

        <div className="form-row">
          <label>What is your ZIP code? <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="zipCode" placeholder="e.g. 78701" required />
        </div>

        <div className="form-row">
          <label>What country do you live in? <span style={{ color: "#dc2626" }}>*</span></label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}>
            <input type="radio" name="country" value="United States" checked={country === "United States"} onChange={() => setCountry("United States")} required /> United States
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="radio" name="country" value="Other" checked={country === "Other"} onChange={() => setCountry("Other")} /> Other:
            {country === "Other" && (
              <input className="input" name="countryOther" placeholder="Enter your country" style={{ flex: 1, marginBottom: 0 }} required />
            )}
          </label>
        </div>

        {/* ── Section 3: Academic Background ── */}
        <SectionHeader>Section 3 — Academic Background</SectionHeader>

        <div className="form-row">
          <label>High School Name <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="schoolName" placeholder="e.g. Lincoln High School" required />
        </div>

        <div className="form-row">
          <label>What year will you graduate from high school? <span style={{ color: "#dc2626" }}>*</span></label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["2026", "2027", "2028", "2029"].map((year) => (
              <label key={year} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="radio" name="graduationYear" value={year} required /> {year}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>GPA (optional)</label>
          <input className="input" name="gpa" placeholder="e.g. 3.8 / 4.0" />
        </div>

        <div className="form-row">
          <label>Class Rank (optional)</label>
          <input className="input" name="classRank" placeholder="e.g. Top 10%, 25 of 300" />
        </div>

        {/* ── Section 4: Chapter Details ── */}
        <SectionHeader>Section 4 — Chapter Details</SectionHeader>

        <div className="form-row">
          <label>Chapter <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Select the chapter you want to lead, or leave blank if proposing a new chapter.
          </p>
          <select className="input" name="chapterId" defaultValue="">
            <option value="">Proposing a new chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Partner / Host School (optional)</label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            If proposing a new chapter, what school would it be based at?
          </p>
          <input className="input" name="partnerSchool" placeholder="e.g. Lincoln High School" />
        </div>

        {/* ── Section 5: Essays & Background ── */}
        <SectionHeader>Section 5 — Essays &amp; Background</SectionHeader>

        <div className="form-row">
          <label>Why do you want to be Chapter President? <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Tell us what drives you to lead a YPP chapter and what you hope to achieve.
          </p>
          <textarea
            name="whyChapterPresident"
            className="input"
            rows={4}
            required
            placeholder="Share your motivation for leading, what excites you about this role, and what impact you want to make..."
            value={whyCP}
            onChange={(e) => setWhyCP(e.target.value)}
          />
          <span style={{ fontSize: 11, color: whyCP.length > 5000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {whyCP.length} / 5,000
          </span>
        </div>

        <div className="form-row">
          <label>Leadership Experience <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Describe your leadership experience and what qualifies you for this role.
          </p>
          <textarea
            name="leadershipExperience"
            className="input"
            rows={5}
            required
            placeholder="Share your leadership roles, team management experience, community involvement..."
            value={leadershipExperience}
            onChange={(e) => setLeadershipExperience(e.target.value)}
          />
          <span style={{ fontSize: 11, color: leadershipExperience.length > 5000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {leadershipExperience.length} / 5,000
          </span>
        </div>

        <div className="form-row">
          <label>Prior Organizing or Club Experience <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Have you helped start or run a club, organization, or event before? Describe it.
          </p>
          <textarea
            name="priorOrganizing"
            className="input"
            rows={3}
            required
            placeholder="Describe any experience founding, running, or coordinating clubs, teams, or events..."
          />
        </div>

        <div className="form-row">
          <label>Extracurricular Activities &amp; Clubs <span style={{ color: "#dc2626" }}>*</span></label>
          <textarea
            name="extracurriculars"
            className="input"
            rows={3}
            required
            placeholder="List clubs, sports, volunteer work, or other activities you participate in..."
          />
        </div>

        <div className="form-row">
          <label>Special Skills or Certifications (optional)</label>
          <textarea
            name="specialSkills"
            className="input"
            rows={2}
            placeholder="e.g. Bilingual (Spanish/English), public speaking, graphic design, event planning..."
          />
        </div>

        {/* ── Section 6: Chapter Vision & Planning ── */}
        <SectionHeader>Section 6 — Chapter Vision &amp; Planning</SectionHeader>

        <div className="form-row">
          <label>Chapter Vision <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            What is your vision for the chapter? What would you focus on?
          </p>
          <textarea
            name="chapterVision"
            className="input"
            rows={5}
            required
            placeholder="Describe your goals for the chapter, programs you'd like to run, how you'd engage students..."
            value={chapterVision}
            onChange={(e) => setChapterVision(e.target.value)}
          />
          <span style={{ fontSize: 11, color: chapterVision.length > 5000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {chapterVision.length} / 5,000
          </span>
        </div>

        <div className="form-row">
          <label>Recruitment Plan <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            How will you recruit instructors and students to your chapter?
          </p>
          <textarea
            name="recruitmentPlan"
            className="input"
            rows={4}
            required
            placeholder="Describe your strategy for finding and onboarding instructors and students..."
            value={recruitmentPlan}
            onChange={(e) => setRecruitmentPlan(e.target.value)}
          />
          <span style={{ fontSize: 11, color: recruitmentPlan.length > 3000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {recruitmentPlan.length} / 3,000
          </span>
        </div>

        <div className="form-row">
          <label>Launch Plan &amp; Timeline <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            What are your milestones for the first semester? When do you want to launch?
          </p>
          <textarea
            name="launchPlan"
            className="input"
            rows={4}
            required
            placeholder="Outline key milestones: first meeting, first lesson, target student count, etc..."
            value={launchPlan}
            onChange={(e) => setLaunchPlan(e.target.value)}
          />
          <span style={{ fontSize: 11, color: launchPlan.length > 3000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {launchPlan.length} / 3,000
          </span>
        </div>

        {/* ── Section 7: Availability ── */}
        <SectionHeader>Section 7 — Availability</SectionHeader>

        <div className="form-row">
          <label>Interview Availability <span style={{ color: "#dc2626" }}>*</span></label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            When are you generally available for an interview?
          </p>
          <input name="availability" className="input" required placeholder="e.g., Weekday evenings after 5pm, Saturday mornings" />
        </div>

        <div className="form-row">
          <label>Hours per week you can commit <span style={{ color: "#dc2626" }}>*</span></label>
          <input className="input" name="hoursPerWeek" type="number" min={1} max={40} placeholder="e.g. 8" required />
        </div>

        <div className="form-row">
          <label>Preferred chapter launch date (optional)</label>
          <input className="input" name="preferredStartDate" type="date" />
        </div>

        {/* ── Section 8: Referrals ── */}
        <SectionHeader>Section 8 — Referrals (Recommended)</SectionHeader>

        <div className="form-row">
          <label>Student referral emails (optional)</label>
          <textarea
            className="input"
            name="referralEmails"
            placeholder="student1@example.com, student2@example.com"
            rows={3}
          />
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
            RECOMMENDED: Please enter the emails of as many high school students as you would like to recommend YPP to. Please separate each email address with a comma. Referring YPP to other students using this field will help us see your devotion!
          </p>
        </div>

        {/* ── Section 9: Optional Demographics ── */}
        <SectionHeader>Section 9 — Optional Demographics</SectionHeader>

        <div className="form-row">
          <label>Race/Ethnicity (optional — for program tracking only)</label>
          <select className="input" name="ethnicity" defaultValue="">
            <option value="">Prefer not to say</option>
            <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
            <option value="Asian or Asian American">Asian or Asian American</option>
            <option value="Black or African American">Black or African American</option>
            <option value="Hispanic or Latino">Hispanic or Latino</option>
            <option value="Middle Eastern or North African">Middle Eastern or North African</option>
            <option value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</option>
            <option value="White or Caucasian">White or Caucasian</option>
            <option value="Two or more races">Two or more races</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* ── Dynamic custom fields from form template ── */}
        {customFields.length > 0 && (
          <>
            <SectionHeader>Additional Questions</SectionHeader>
            {customFields.map((field) => (
              <div className="form-row" key={field.id}>
                <label>
                  {field.label}
                  {field.required && <span style={{ color: "#dc2626" }}> *</span>}
                </label>
                {field.helpText && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{field.helpText}</p>
                )}

                {field.fieldType === "SHORT_TEXT" && (
                  <input
                    name={`custom_field_${field.id}`}
                    className="input"
                    required={field.required}
                    placeholder={field.placeholder ?? ""}
                    value={customValues[field.id] || ""}
                    onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  />
                )}

                {field.fieldType === "LONG_TEXT" && (
                  <textarea
                    name={`custom_field_${field.id}`}
                    className="input"
                    rows={4}
                    required={field.required}
                    placeholder={field.placeholder ?? ""}
                    value={customValues[field.id] || ""}
                    onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  />
                )}

                {field.fieldType === "MULTIPLE_CHOICE" && field.options && (
                  <select
                    name={`custom_field_${field.id}`}
                    className="input"
                    required={field.required}
                    value={customValues[field.id] || ""}
                    onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  >
                    <option value="">Select an option...</option>
                    {(() => {
                      try {
                        return (JSON.parse(field.options) as string[]).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ));
                      } catch { return null; }
                    })()}
                  </select>
                )}

                {field.fieldType === "RATING_SCALE" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`custom_field_${field.id}`}
                          value={String(n)}
                          required={field.required}
                          checked={customValues[field.id] === String(n)}
                          onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                )}

                {field.fieldType === "FILE_UPLOAD" && (
                  <>
                    <FileUpload
                      category="OTHER"
                      entityType="APPLICATION_CUSTOM"
                      accept="*"
                      maxSizeMB={10}
                      label="Upload File"
                      compact
                      onUploadComplete={(file) => setCustomValues((v) => ({ ...v, [field.id]: file.url }))}
                    />
                    <input type="hidden" name={`custom_file_${field.id}`} value={customValues[field.id] || ""} />
                  </>
                )}
              </div>
            ))}
          </>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
