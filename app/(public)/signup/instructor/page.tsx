"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import BrandLockup from "@/components/brand-lockup";
import { navigateToAuthDestination } from "@/lib/auth-client-navigation";
import { createBrowserClientOrNull } from "@/lib/supabase/client";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";
import {
  clearInstructorSignupDraft,
  loadInstructorSignupDraft,
  saveInstructorSignupDraft,
  type InstructorSignupDraftV1,
} from "@/lib/instructor-signup-draft";
import { signUp, type SignupFormState } from "@/lib/signup-actions";

const initialState: SignupFormState = { status: "idle" as const, message: "" };

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
    4: "About 3–5 minutes left.",
    5: "About 1–2 minutes left.",
  };
  return hints[section] ?? hints[5];
}

function field(
  draft: InstructorSignupDraftV1 | null,
  key: string,
  serverFields?: Record<string, string>
): string | undefined {
  // Server state (most recent submission attempt) wins over local draft
  if (serverFields && key in serverFields) {
    const sv = serverFields[key];
    return sv === "" ? undefined : sv;
  }
  const v = draft?.fields[key];
  return v === "" ? undefined : v;
}

const SECTION_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const HR: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border)",
  margin: "24px 0 20px",
};

const HELPER: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginTop: 5,
  lineHeight: 1.5,
};

export default function InstructorSignupPage() {
  const [state, formAction] = useFormState(signUp, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [activeSection, setActiveSection] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const [appliedDraft, setAppliedDraft] = useState<InstructorSignupDraftV1 | null>(null);
  const [resumeBanner, setResumeBanner] = useState<InstructorSignupDraftV1 | null>(null);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRef = useRef("");
  const passwordRef = useRef("");

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveInstructorSignupDraft(formRef.current, "");
      saveTimerRef.current = null;
    }, 800);
  }, []);

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

  // Save immediately on any server response (error or success) so in-progress answers survive
  useEffect(() => {
    if (state.status === "error") {
      saveInstructorSignupDraft(formRef.current, "");
    }
  }, [state.status, state.message]);

  useEffect(() => {
    if (state.status === "success" && state.message === "APPLICATION_SUBMITTED") {
      clearInstructorSignupDraft();
      setAutoLoggingIn(true);

      async function doSignIn() {
        const email = emailRef.current;
        const password = passwordRef.current;

        const supabaseClient = createBrowserClientOrNull();
        if (supabaseClient) {
          const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (!signInError) {
            navigateToAuthDestination("/application-status");
            return;
          }
        }

        if (canUseLocalPasswordFallback()) {
          const response = await fetch("/api/auth/local-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (response.ok) {
            navigateToAuthDestination("/application-status");
            return;
          }
        }

        setAutoLoginError("Your application was submitted! Sign in below to view your status.");
      }

      doSignIn();
    }
  }, [state.status, state.message]);

  function handleResume() {
    if (!resumeBanner) return;
    setAppliedDraft(resumeBanner);
    setResumeBanner(null);
    setFormKey((k) => k + 1);
  }

  function handleDismissResume() {
    clearInstructorSignupDraft();
    setResumeBanner(null);
  }

  const d = appliedDraft;
  // Server-returned fields from last submission attempt (excludes password)
  const sf = state.fields;

  const [hearAbout, setHearAbout] = useState(() => field(d, "hearAboutYPPOption", sf) ?? "");
  const [hearAboutDetail, setHearAboutDetail] = useState(() => field(d, "hearAboutYPPDetail", sf) ?? "");

  useEffect(() => {
    setHearAbout(field(d, "hearAboutYPPOption", sf) ?? "");
    setHearAboutDetail(field(d, "hearAboutYPPDetail", sf) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, sf]);

  const hearAboutNeedsName = hearAbout === "A YPP staff member" || hearAbout === "A YPP student";
  const hearAboutNeedsDetail = hearAbout === "Other";
  const hearAboutCombined = hearAboutDetail.trim()
    ? `${hearAbout}: ${hearAboutDetail.trim()}`
    : hearAbout;

  if (autoLoggingIn) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}>
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          {autoLoginError ? (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>Application submitted!</h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>{autoLoginError}</p>
              <Link href="/login?callbackUrl=/application-status" className="button" style={{ marginTop: 12, display: "inline-block" }}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>Setting up your account…</h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>Signing you in and taking you to your application status</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <BrandLockup height={30} className="brand-lockup" priority reloadOnClick />
        <span className="badge" style={{ fontSize: 11 }}>Instructor Application</span>
      </div>

      {/* Page body */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 32px 80px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Apply to become a YPP instructor.</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.6 }}>
          Share your background, availability, and a rough class plan so the review team can understand what you want to teach and whether an interview is the right next step.
        </p>

        {resumeBanner && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: 13, lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 10px" }}>
              We found a saved application on this device from{" "}
              {new Date(resumeBanner.savedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
              Your password is never stored — you will re-enter it before submitting.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="button" style={{ fontSize: 13, padding: "8px 14px" }} onClick={handleResume}>
                Resume saved application
              </button>
              <button type="button" className="button secondary" style={{ fontSize: 13, padding: "8px 14px" }} onClick={handleDismissResume}>
                Clear saved draft
              </button>
            </div>
          </div>
        )}

        {/* Progress stepper */}
        <div style={{ marginBottom: 28 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 4, fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
          onSubmit={() => saveInstructorSignupDraft(formRef.current, "")}
          onFocusCapture={(e) => {
            const section = (e.target as HTMLElement | null)?.closest?.("[data-signup-section]") as HTMLElement | null;
            const n = section?.dataset.signupSection ? parseInt(section.dataset.signupSection, 10) : NaN;
            if (!Number.isNaN(n) && n >= 1 && n <= 5) setActiveSection(n);
          }}
        >
          <input type="hidden" name="accountType" value="APPLICANT" />
          <input type="hidden" name="hearAboutYPP" value={hearAboutCombined} />

          {/* ── 1. Account ── */}
          <div data-signup-section="1">
            <div style={SECTION_STYLE}>Account</div>

            <label className="form-label" style={{ marginTop: 0 }}>
              Full name
              <input className="input" name="name" placeholder="Your full name" required defaultValue={field(d, "name", sf)} />
            </label>

            <label className="form-label">
              Email
              <input
                className="input"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                defaultValue={field(d, "email", sf)}
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
              <select className="input" name="chapterId" defaultValue={field(d, "chapterId", sf) ?? ""}>
                <option value="">Select a chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
                ))}
              </select>
            </label>
          </div>

          <hr style={HR} />

          {/* ── 2. Personal details ── */}
          <div data-signup-section="2">
            <div style={SECTION_STYLE}>Personal details</div>

            <label className="form-label">
              Legal name
              <input className="input" name="legalName" placeholder="First, middle, and last name" required defaultValue={field(d, "legalName", sf)} />
            </label>

            <label className="form-label">
              Preferred first name
              <input className="input" name="preferredFirstName" placeholder="What should we call you?" required defaultValue={field(d, "preferredFirstName", sf)} />
            </label>

            <div className="grid two">
              <label className="form-label">
                Phone number
                <input className="input" name="phoneNumber" type="tel" placeholder="(555) 123-4567" defaultValue={field(d, "phoneNumber", sf)} />
              </label>
              <label className="form-label">
                Date of birth
                <input className="input" name="dateOfBirth" type="date" defaultValue={field(d, "dateOfBirth", sf)} />
              </label>
            </div>

            <label className="form-label">
              How did you hear about YPP?
              <select
                className="input"
                name="hearAboutYPPOption"
                value={hearAbout}
                onChange={(e) => { setHearAbout(e.target.value); setHearAboutDetail(""); }}
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

          <hr style={HR} />

          {/* ── 3. Location & school ── */}
          <div data-signup-section="3">
            <div style={SECTION_STYLE}>Location and school</div>

            <div className="grid two">
              <label className="form-label">
                City
                <input className="input" name="city" placeholder="e.g. Phoenix" required defaultValue={field(d, "city", sf)} />
              </label>
              <label className="form-label">
                State or province
                <input className="input" name="stateProvince" placeholder="e.g. Arizona" required defaultValue={field(d, "stateProvince", sf)} />
              </label>
            </div>

            <div className="grid two">
              <label className="form-label">
                ZIP or postal code
                <input className="input" name="zipCode" placeholder="e.g. 85004" required defaultValue={field(d, "zipCode", sf)} />
              </label>
              <label className="form-label">
                Country
                <select className="input" name="country" defaultValue={field(d, "country", sf) ?? "United States"} required>
                  <option value="United States">United States</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="form-label">
              If you chose &quot;Other,&quot; which country?
              <input className="input" name="countryOther" placeholder="Optional" defaultValue={field(d, "countryOther", sf)} />
            </label>

            <label className="form-label">
              High school name
              <input className="input" name="schoolName" placeholder="Your school" required defaultValue={field(d, "schoolName", sf)} />
            </label>

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
                defaultValue={field(d, "graduationYear", sf)}
              />
            </label>

            <label className="form-label">
              Subjects of interest
              <input className="input" name="subjectsOfInterest" placeholder="Optional" defaultValue={field(d, "subjectsOfInterest", sf)} />
            </label>
          </div>

          <hr style={HR} />

          {/* ── 4. Teaching application ── */}
          <div data-signup-section="4">
            <div style={SECTION_STYLE}>Teaching application</div>

            <label className="form-label">
              Teaching or mentoring experience
              <textarea className="input" name="teachingExperience" rows={4} required defaultValue={field(d, "teachingExperience", sf)} />
            </label>

            <label className="form-label">
              What class would you like to teach?
              <input
                className="input"
                name="courseIdea"
                placeholder="e.g. Personal finance for middle school students"
                required
                defaultValue={field(d, "courseIdea", sf) ?? field(d, "textbook", sf)}
              />
              <span style={HELPER}>
                Give the review team a clear title or short description of the class you want to lead.
              </span>
            </label>

            <label className="form-label">
              Rough course outline
              <textarea
                className="input"
                name="courseOutline"
                rows={5}
                required
                placeholder={
                  "List the main topics or units across the full course. Bullet points are great.\n\nExample:\n- Week 1: What is personal finance?\n- Week 2: Budgeting basics\n- Week 3: Saving and investing\n..."
                }
                defaultValue={field(d, "courseOutline", sf)}
              />
              <span style={HELPER}>
                Share the main topics you would expect to cover. This should be professional enough to review, but it is still only an early outline.
              </span>
            </label>

            <label className="form-label">
              First-session sketch
              <textarea
                className="input"
                name="firstClassPlan"
                rows={5}
                required
                placeholder={
                  "Walk us through how you'd run your very first session.\n\nExample:\n- Open with an icebreaker (5 min)\n- Introduce the course and yourself (10 min)\n- Teach the first concept with examples (20 min)\n- Q&A and wrap-up (10 min)"
                }
                defaultValue={field(d, "firstClassPlan", sf)}
              />
              <span style={HELPER}>
                Describe how you would open the first session, what you would teach first, and how you would close.
              </span>
            </label>

            <label className="form-label">
              Optional written motivation
              <textarea className="input" name="motivation" rows={3} defaultValue={field(d, "motivation", sf)} />
            </label>
          </div>

          <hr style={HR} />

          {/* ── 5. Availability ── */}
          <div data-signup-section="5">
            <div style={SECTION_STYLE}>Availability</div>

            <label className="form-label">
              Interview availability
              <input
                className="input"
                name="availability"
                placeholder="e.g. weekday evenings, time zone"
                required
                defaultValue={field(d, "availability", sf)}
              />
            </label>

            <div className="grid two">
              <label className="form-label">
                Hours per week you can commit
                <input className="input" name="hoursPerWeek" type="number" min={1} max={40} required defaultValue={field(d, "hoursPerWeek", sf)} />
              </label>
              <label className="form-label">
                Preferred start date
                <input className="input" name="preferredStartDate" type="date" defaultValue={field(d, "preferredStartDate", sf)} />
              </label>
            </div>

            <label className="form-label">
              Referral emails
              <textarea className="input" name="referralEmails" rows={3} defaultValue={field(d, "referralEmails", sf)} />
            </label>
          </div>

          {state.message && state.message !== "APPLICATION_SUBMITTED" && (
            <div className={state.status === "error" ? "form-error" : "form-success"} style={{ marginTop: 16 }}>
              {state.message}
            </div>
          )}

          <button className="button" type="submit" style={{ marginTop: 24, width: "100%" }}>
            Submit Application
          </button>
        </form>

        <div className="login-help" style={{ marginTop: 24 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
        <div className="login-help" style={{ marginTop: 8 }}>
          Need the family signup instead? <Link href="/signup">Create a family account</Link>
        </div>
      </div>
    </div>
  );
}
