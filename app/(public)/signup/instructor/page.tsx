"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useFormState } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import ApplicantVideoUpload from "@/components/applicant-video-upload";
import BrandLockup from "@/components/brand-lockup";
import {
  clearInstructorSignupDraft,
  loadInstructorSignupDraft,
  saveInstructorSignupDraft,
  type InstructorSignupDraftV1,
} from "@/lib/instructor-signup-draft";
import { signUp } from "@/lib/signup-actions";

const initialState = { status: "idle" as const, message: "" };

const SECTION_LABELS = ["Account", "Profile", "School", "Teaching", "Availability"] as const;

const HEAR_ABOUT_OPTIONS = [
  "Word of mouth",
  "TikTok",
  "Instagram",
  "A YPP staff member",
  "A YPP student",
  "Other",
] as const;

function timeHint(section: number): string {
  const hints: Record<number, string> = {
    1: "About 8–12 minutes left from here. You can leave and come back — we save your answers on this device (except your password).",
    2: "About 6–9 minutes left.",
    3: "About 4–6 minutes left.",
    4: "About 2–4 minutes left, including your short video.",
    5: "About 1–2 minutes left.",
  };
  return hints[section] ?? hints[5];
}

function field(
  draft: InstructorSignupDraftV1 | null,
  key: string
): string | undefined {
  const v = draft?.fields[key];
  return v === "" ? undefined : v;
}

export default function InstructorSignupPage() {
  const [state, formAction] = useFormState(signUp, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [motivationVideoUrl, setMotivationVideoUrl] = useState("");
  const [motivationVideoUploading, setMotivationVideoUploading] = useState(false);
  const [activeSection, setActiveSection] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const [appliedDraft, setAppliedDraft] = useState<InstructorSignupDraftV1 | null>(null);
  const [resumeBanner, setResumeBanner] = useState<InstructorSignupDraftV1 | null>(null);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture credentials for auto-login (never stored in state to avoid extra renders)
  const emailRef = useRef("");
  const passwordRef = useRef("");

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveInstructorSignupDraft(formRef.current, motivationVideoUrl);
      saveTimerRef.current = null;
    }, 800);
  }, [motivationVideoUrl]);

  useEffect(() => {
    async function loadChapters() {
      const response = await fetch("/api/chapters");
      if (!response.ok) return;
      const data = await response.json();
      setChapters(Array.isArray(data) ? data : []);
    }

    loadChapters();
  }, []);

  useEffect(() => {
    const existing = loadInstructorSignupDraft();
    if (existing && (existing.fields.email || existing.fields.name || existing.fields.legalName)) {
      setResumeBanner(existing);
    }
  }, []);

  // Auto-login after successful application submission
  useEffect(() => {
    if (state.status === "success" && state.message === "APPLICATION_SUBMITTED") {
      clearInstructorSignupDraft();
      setAutoLoggingIn(true);
      signIn("credentials", {
        email: emailRef.current,
        password: passwordRef.current,
        callbackUrl: "/application-status",
        redirect: true,
      });
    }
  }, [state.status, state.message]);

  useEffect(() => {
    scheduleSave();
  }, [motivationVideoUrl, scheduleSave]);

  function handleResume() {
    if (!resumeBanner) return;
    setAppliedDraft(resumeBanner);
    setMotivationVideoUrl(resumeBanner.motivationVideoUrl || "");
    setResumeBanner(null);
    setFormKey((k) => k + 1);
  }

  function handleDismissResume() {
    clearInstructorSignupDraft();
    setResumeBanner(null);
  }

  const d = appliedDraft;

  // Hear-about state — initialised from draft when form remounts
  const [hearAbout, setHearAbout] = useState(() => field(d, "hearAboutYPPOption") ?? "");
  const [hearAboutDetail, setHearAboutDetail] = useState(() => field(d, "hearAboutYPPDetail") ?? "");

  // Keep hear-about in sync when draft is applied (formKey changes cause remount,
  // but we also handle it via useEffect for safety)
  useEffect(() => {
    setHearAbout(field(d, "hearAboutYPPOption") ?? "");
    setHearAboutDetail(field(d, "hearAboutYPPDetail") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const hearAboutNeedsName =
    hearAbout === "A YPP staff member" || hearAbout === "A YPP student";
  const hearAboutNeedsDetail = hearAbout === "Other";
  const hearAboutCombined =
    hearAboutDetail.trim()
      ? `${hearAbout}: ${hearAboutDetail.trim()}`
      : hearAbout;

  // Loading state while auto-login redirect fires
  if (autoLoggingIn) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center", textAlign: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Setting up your account…
              </h1>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Signing you in and taking you to your application status
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-grid" style={{ maxWidth: 1120 }}>
        <section className="login-hero">
          <div className="login-logo login-logo--lockup">
            <BrandLockup height={52} className="brand-lockup" priority reloadOnClick />
          </div>
          <p className="badge">Instructor Application</p>
          <h1 className="page-title mt-8">Apply to become a YPP instructor.</h1>
          <p className="hero-subtitle mt-12">
            This route is only for instructor applicants. Family account creation now has its own signup flow, so this page can stay focused on the teaching application.
          </p>
          <p className="hero-subtitle mt-12" style={{ fontSize: 14 }}>
            The process is supportive: we are getting to know how you teach, not scoring you like an exam. The optional curriculum overview later works the same way — a conversation, not a test.
          </p>
        </section>

        <div className="login-card">
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Instructor Application
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Complete the application below to be reviewed by YPP leadership
              </p>
            </div>
          </div>

          {resumeBanner && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: "0 0 10px" }}>
                We found a saved application on this device from{" "}
                {new Date(resumeBanner.savedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                . Your password is never stored — you will re-enter it before submitting.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" className="button" style={{ fontSize: 13, padding: "8px 14px" }} onClick={handleResume}>
                  Resume saved application
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 13, padding: "8px 14px" }}
                  onClick={handleDismissResume}
                >
                  Clear saved draft
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <strong>How we review:</strong> we want to understand your teaching style. This is not a scored exam. After you apply,
            the curriculum overview is a two-way conversation about your approach and materials — still not a test.
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    background: n <= activeSection ? "#6b21c8" : "var(--border)",
                    opacity: n === activeSection ? 1 : n < activeSection ? 0.85 : 1,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 4,
                fontSize: 10,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {SECTION_LABELS.map((label, i) => (
                <span key={label} style={{ flex: 1, textAlign: "center", fontWeight: activeSection === i + 1 ? 700 : 500 }}>
                  {label}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.45 }}>{timeHint(activeSection)}</p>
          </div>

          <form
            key={formKey}
            ref={formRef}
            action={formAction}
            onInput={scheduleSave}
            onFocusCapture={(e) => {
              const section = (e.target as HTMLElement | null)?.closest?.("[data-signup-section]") as HTMLElement | null;
              const n = section?.dataset.signupSection ? parseInt(section.dataset.signupSection, 10) : NaN;
              if (!Number.isNaN(n) && n >= 1 && n <= 5) setActiveSection(n);
            }}
          >
            <input type="hidden" name="accountType" value="APPLICANT" />
            <input type="hidden" name="motivationVideoUrl" value={motivationVideoUrl} />
            {/* Combined hear-about value passed to server action */}
            <input type="hidden" name="hearAboutYPP" value={hearAboutCombined} />

            <div data-signup-section="1">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Account
              </div>

              <label className="form-label" style={{ marginTop: 0 }}>
                Full name
                <input
                  className="input"
                  name="name"
                  placeholder="Your full name"
                  required
                  defaultValue={field(d, "name")}
                />
              </label>

              <label className="form-label">
                Email
                <input
                  className="input"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  defaultValue={field(d, "email")}
                  onInput={(e) => { emailRef.current = (e.target as HTMLInputElement).value; }}
                />
              </label>

              <label className="form-label">
                Password
                <input
                  className="input"
                  name="password"
                  type="password"
                  placeholder="Min 8 characters, letter + number"
                  required
                  onInput={(e) => { passwordRef.current = (e.target as HTMLInputElement).value; }}
                />
              </label>

              <label className="form-label">
                Chapter
                <select className="input" name="chapterId" defaultValue={field(d, "chapterId") ?? ""}>
                  <option value="">Select a chapter</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div data-signup-section="2">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Personal details
              </div>

              <label className="form-label">
                Legal name
                <input
                  className="input"
                  name="legalName"
                  placeholder="First, middle, and last name"
                  required
                  defaultValue={field(d, "legalName")}
                />
              </label>

              <label className="form-label">
                Preferred first name
                <input
                  className="input"
                  name="preferredFirstName"
                  placeholder="What should we call you?"
                  required
                  defaultValue={field(d, "preferredFirstName")}
                />
              </label>

              <div className="grid two">
                <label className="form-label">
                  Phone number
                  <input className="input" name="phoneNumber" type="tel" placeholder="(555) 123-4567" defaultValue={field(d, "phoneNumber")} />
                </label>
                <label className="form-label">
                  Date of birth
                  <input className="input" name="dateOfBirth" type="date" defaultValue={field(d, "dateOfBirth")} />
                </label>
              </div>

              <label className="form-label">
                How did you hear about YPP?
                <select
                  className="input"
                  name="hearAboutYPPOption"
                  value={hearAbout}
                  onChange={(e) => {
                    setHearAbout(e.target.value);
                    setHearAboutDetail("");
                  }}
                >
                  <option value="">Select one (optional)</option>
                  {HEAR_ABOUT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {(hearAboutNeedsName || hearAboutNeedsDetail) && (
                  <input
                    className="input"
                    name="hearAboutYPPDetail"
                    style={{ marginTop: 6 }}
                    placeholder={hearAboutNeedsName ? "Enter their name" : "Please specify"}
                    value={hearAboutDetail}
                    onChange={(e) => setHearAboutDetail(e.target.value)}
                  />
                )}
              </label>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div data-signup-section="3">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Location and school
              </div>

              <div className="grid two">
                <label className="form-label">
                  City
                  <input className="input" name="city" placeholder="e.g. Phoenix" required defaultValue={field(d, "city")} />
                </label>
                <label className="form-label">
                  State or province
                  <input
                    className="input"
                    name="stateProvince"
                    placeholder="e.g. Arizona"
                    required
                    defaultValue={field(d, "stateProvince")}
                  />
                </label>
              </div>

              <div className="grid two">
                <label className="form-label">
                  ZIP or postal code
                  <input className="input" name="zipCode" placeholder="e.g. 85004" required defaultValue={field(d, "zipCode")} />
                </label>
                <label className="form-label">
                  Country
                  <select className="input" name="country" defaultValue={field(d, "country") ?? "United States"} required>
                    <option value="United States">United States</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>

              <label className="form-label">
                If you chose &quot;Other,&quot; which country?
                <input className="input" name="countryOther" placeholder="Optional" defaultValue={field(d, "countryOther")} />
              </label>

              <label className="form-label">
                High school name
                <input className="input" name="schoolName" placeholder="Your school" required defaultValue={field(d, "schoolName")} />
              </label>

              <div className="grid two">
                <label className="form-label">
                  Graduation year
                  <input
                    className="input"
                    name="graduationYear"
                    type="number"
                    min={2025}
                    max={2030}
                    placeholder="e.g. 2027"
                    required
                    defaultValue={field(d, "graduationYear")}
                  />
                </label>
                <label className="form-label">
                  GPA
                  <input className="input" name="gpa" placeholder="Optional" defaultValue={field(d, "gpa")} />
                </label>
              </div>

              <label className="form-label">
                Class rank
                <input className="input" name="classRank" placeholder="Optional" defaultValue={field(d, "classRank")} />
              </label>

              <label className="form-label">
                Subjects of interest
                <input className="input" name="subjectsOfInterest" placeholder="Optional" defaultValue={field(d, "subjectsOfInterest")} />
              </label>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div data-signup-section="4">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Teaching application
              </div>

              <label className="form-label">
                Teaching or mentoring experience
                <textarea className="input" name="teachingExperience" rows={4} required defaultValue={field(d, "teachingExperience")} />
              </label>

              <label className="form-label">
                Teaching approach video
                <div style={{ marginTop: 8 }}>
                  <ApplicantVideoUpload
                    onUploadComplete={(file) => setMotivationVideoUrl(file.url)}
                    onUploadStateChange={setMotivationVideoUploading}
                  />
                </div>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                  Aim for <strong>about 2–3 minutes</strong> (shorter is fine; uploads may allow up to five minutes). Film on your phone in one take if that is easiest, then upload the file here from your camera roll or computer. We care about how you explain ideas, not production quality.
                </span>
              </label>

              <label className="form-label">
                Optional written motivation
                <textarea className="input" name="motivation" rows={3} defaultValue={field(d, "motivation")} />
              </label>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div data-signup-section="5">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Availability
              </div>

              <label className="form-label">
                Curriculum overview session availability
                <input
                  className="input"
                  name="availability"
                  placeholder="e.g. weekday evenings, time zone"
                  required
                  defaultValue={field(d, "availability")}
                />
              </label>

              <div className="grid two">
                <label className="form-label">
                  Hours per week you can commit
                  <input
                    className="input"
                    name="hoursPerWeek"
                    type="number"
                    min={1}
                    max={40}
                    required
                    defaultValue={field(d, "hoursPerWeek")}
                  />
                </label>
                <label className="form-label">
                  Preferred start date
                  <input className="input" name="preferredStartDate" type="date" defaultValue={field(d, "preferredStartDate")} />
                </label>
              </div>

              <label className="form-label">
                Referral emails
                <textarea className="input" name="referralEmails" rows={3} defaultValue={field(d, "referralEmails")} />
              </label>

              <label className="form-label">
                Race or ethnicity
                <input className="input" name="ethnicity" placeholder="Optional" defaultValue={field(d, "ethnicity")} />
              </label>
            </div>

            {state.message && state.message !== "APPLICATION_SUBMITTED" && (
              <div className={state.status === "error" ? "form-error" : "form-success"}>
                {state.message}
              </div>
            )}

            <button
              className="button"
              type="submit"
              disabled={motivationVideoUploading || !motivationVideoUrl}
            >
              {motivationVideoUploading ? "Uploading video..." : "Submit Application"}
            </button>

            {!motivationVideoUrl && !motivationVideoUploading && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Upload the required teaching approach video to unlock submission.
              </p>
            )}
          </form>

          <div className="login-help">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
          <div className="login-help" style={{ marginTop: 8 }}>
            Need the family signup instead? <Link href="/signup">Create a family account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
