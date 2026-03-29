"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import { signIn } from "next-auth/react";
import { signUp } from "@/lib/signup-actions";
import { useEffect, useState } from "react";
import ResendVerificationForm from "@/app/(public)/verify-email/resend-form";

const initialState = { status: "idle" as const, message: "" };

export default function SignupPage() {
  const [state, formAction] = useFormState(signUp, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [accountType, setAccountType] = useState("STUDENT");

  useEffect(() => {
    async function loadChapters() {
      const response = await fetch("/api/chapters");
      if (!response.ok) return;
      const data = await response.json();
      setChapters(Array.isArray(data) ? data : []);
    }
    loadChapters();
  }, []);

  // Show "Application Submitted" confirmation for new applicants
  if (state.status === "success" && state.message === "APPLICATION_SUBMITTED") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>Application Submitted!</h1>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                We&apos;ve received your instructor application
              </p>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
            We sent a verification link to <strong>{submittedEmail || "your email"}</strong>.
            Please verify your email address first to activate your account.
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
            Once verified, an admin or chapter president will review your application and reach out to schedule an interview. You can log in at any time to check your application status.
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Didn&apos;t get the verification email? Check your spam folder, or request a new link below.
          </p>
          <ResendVerificationForm initialEmail={submittedEmail} />
          <div className="login-help" style={{ marginTop: 16 }}>
            <Link href="/login">Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  // Show confirmation after successful signup
  if (state.status === "success" && state.message === "ACCOUNT_CREATED") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>Account Created</h1>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                You&apos;re ready to sign in
              </p>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Your account has been created. You can now sign in with your email and password.
          </p>
          <div className="login-help" style={{ marginTop: 16 }}>
            <Link href="/login">Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header login-card-header--stacked">
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              Join Youth Passion Project
            </h1>
            <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
              Create a student account or apply to become an instructor
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="button secondary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Sign up with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>or create account with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <form
          action={formAction}
          onSubmit={(e) => {
            const data = new FormData(e.currentTarget);
            setSubmittedEmail(String(data.get("email") ?? ""));
          }}
        >
          <label className="form-label" style={{ marginTop: 0 }}>
            Full Name
            <input className="input" name="name" placeholder="Your full name" required />
          </label>
          <label className="form-label">
            Email
            <input className="input" name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label className="form-label">
            Phone (optional)
            <input className="input" name="phone" type="tel" placeholder="(555) 123-4567" />
          </label>
          <label className="form-label">
            Password
            <input className="input" name="password" type="password" placeholder="Min 8 characters" required />
          </label>
          <label className="form-label">
            Account Type
            <select
              className="input"
              name="accountType"
              defaultValue="STUDENT"
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="STUDENT">Student</option>
              <option value="APPLICANT">Instructor Applicant (apply to become an instructor)</option>
            </select>
            {accountType === "APPLICANT" && (
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Your application will be reviewed by an admin or chapter president before you are approved as an instructor.
              </span>
            )}
          </label>
          <label className="form-label">
            Chapter (optional)
            <select className="input" name="chapterId" defaultValue="">
              <option value="">Select a chapter</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>

          {/* Additional fields for instructor applicants */}
          {accountType === "APPLICANT" && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 1 — Personal Information
              </p>

              <label className="form-label">
                Full Legal Name (First, Middle, and Last) <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="legalName"
                  placeholder="e.g. Jane Marie Smith"
                  required
                />
              </label>
              <label className="form-label">
                Preferred First Name <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="preferredFirstName"
                  placeholder="What would you like us to call you?"
                  required
                />
              </label>
              <label className="form-label">
                Phone Number (optional)
                <input
                  className="input"
                  name="phoneNumber"
                  type="tel"
                  placeholder="(555) 123-4567"
                />
              </label>
              <label className="form-label">
                Date of Birth (optional)
                <input
                  className="input"
                  name="dateOfBirth"
                  type="date"
                />
              </label>
              <label className="form-label">
                How did you hear about YPP? (optional)
                <select className="input" name="hearAboutYPP" defaultValue="">
                  <option value="">Select one</option>
                  <option value="Social media">Social media</option>
                  <option value="Friend or classmate">Friend or classmate</option>
                  <option value="Teacher or counselor">Teacher or counselor</option>
                  <option value="School announcement">School announcement</option>
                  <option value="YPP website">YPP website</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 2 — Location
              </p>

              <label className="form-label">
                What town/city do you live in? <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="city"
                  placeholder="e.g. Austin"
                  required
                />
              </label>
              <label className="form-label">
                What state/province do you live in? <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="stateProvince"
                  placeholder="e.g. Texas"
                  required
                />
              </label>
              <label className="form-label">
                What is your ZIP code? <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="zipCode"
                  placeholder="e.g. 78701"
                  required
                />
              </label>
              <div>
                <p className="form-label" style={{ marginBottom: 6 }}>
                  What country do you live in? <span style={{ color: "#dc2626" }}>*</span>
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}>
                  <input type="radio" name="country" value="United States" defaultChecked required /> United States
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}>
                  <input type="radio" name="country" value="Other" /> Other:
                  <input
                    className="input"
                    name="countryOther"
                    placeholder="Enter your country"
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                </label>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 3 — Academic Background
              </p>

              <label className="form-label">
                High School Name <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="schoolName"
                  placeholder="e.g. Lincoln High School"
                  required
                />
              </label>
              <div>
                <p className="form-label" style={{ marginBottom: 6 }}>
                  What year will you graduate from high school? <span style={{ color: "#dc2626" }}>*</span>
                </p>
                {["2026", "2027", "2028", "2029"].map((year) => (
                  <label key={year} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}>
                    <input type="radio" name="graduationYear" value={year} required /> {year}
                  </label>
                ))}
              </div>
              <label className="form-label">
                GPA (optional)
                <input
                  className="input"
                  name="gpa"
                  placeholder="e.g. 3.8 / 4.0"
                />
              </label>
              <label className="form-label">
                Class Rank (optional)
                <input
                  className="input"
                  name="classRank"
                  placeholder="e.g. Top 10%, 25 of 300"
                />
              </label>
              <label className="form-label">
                Subjects of Interest (optional)
                <input
                  className="input"
                  name="subjectsOfInterest"
                  placeholder="e.g. Math, Computer Science, English, Biology"
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Separate subjects with commas.
                </span>
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 4 — Essays &amp; Background
              </p>

              <label className="form-label">
                Why do you want to join YPP? <span style={{ color: "#dc2626" }}>*</span>
                <textarea
                  className="input"
                  name="whyYPP"
                  placeholder="Tell us why YPP excites you and what you hope to accomplish as part of this program..."
                  required
                  rows={4}
                  style={{ resize: "vertical" }}
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Minimum 100 characters.</span>
              </label>
              <label className="form-label">
                What motivates you to want to teach? <span style={{ color: "#dc2626" }}>*</span>
                <textarea
                  className="input"
                  name="motivation"
                  placeholder="Share what inspires you to teach and what you hope to bring to your students..."
                  required
                  rows={4}
                  style={{ resize: "vertical" }}
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Minimum 100 characters.</span>
              </label>
              <label className="form-label">
                Teaching or mentoring experience <span style={{ color: "#dc2626" }}>*</span>
                <textarea
                  className="input"
                  name="teachingExperience"
                  placeholder="Describe any prior experience in teaching, tutoring, mentoring, or leading groups..."
                  required
                  rows={4}
                  style={{ resize: "vertical" }}
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Minimum 50 characters.</span>
              </label>
              <label className="form-label">
                Extracurricular activities &amp; clubs <span style={{ color: "#dc2626" }}>*</span>
                <textarea
                  className="input"
                  name="extracurriculars"
                  placeholder="List clubs, sports, volunteer work, arts, or other activities you participate in..."
                  required
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </label>
              <label className="form-label">
                Prior leadership experience <span style={{ color: "#dc2626" }}>*</span>
                <textarea
                  className="input"
                  name="priorLeadership"
                  placeholder="Describe any leadership roles you've held — in school, community, or other settings..."
                  required
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </label>
              <label className="form-label">
                Special skills or certifications (optional)
                <textarea
                  className="input"
                  name="specialSkills"
                  placeholder="e.g. CPR certified, bilingual (Spanish/English), public speaking, coding, etc."
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 5 — Availability
              </p>

              <label className="form-label">
                Interview availability <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="availability"
                  placeholder="e.g. Weekday evenings, Saturday mornings..."
                  required
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  When are you generally available for a short interview call?
                </span>
              </label>
              <label className="form-label">
                Hours per week you can commit <span style={{ color: "#dc2626" }}>*</span>
                <input
                  className="input"
                  name="hoursPerWeek"
                  type="number"
                  min={1}
                  max={40}
                  placeholder="e.g. 5"
                  required
                />
              </label>
              <label className="form-label">
                Preferred start date (optional)
                <input
                  className="input"
                  name="preferredStartDate"
                  type="date"
                />
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 6 — Referrals (Recommended)
              </p>

              <label className="form-label">
                Student referral emails (optional)
                <textarea
                  className="input"
                  name="referralEmails"
                  placeholder="student1@example.com, student2@example.com"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  RECOMMENDED: Please enter the emails of as many high school students as you would like to recommend YPP to. Please separate each email address with a comma. Referring YPP to other students using this field will help us see your devotion!
                </span>
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Section 7 — Optional Demographics
              </p>
              <label className="form-label">
                Race/Ethnicity (optional — for program tracking only)
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
              </label>
            </>
          )}

          {state.message && state.message !== "ACCOUNT_CREATED" && state.message !== "APPLICATION_SUBMITTED" && (
            <div className={state.status === "error" ? "form-error" : "form-success"}>
              {state.message}
            </div>
          )}
          <button className="button" type="submit">
            {accountType === "APPLICANT" ? "Submit Application" : "Create Account"}
          </button>
        </form>
        <div className="login-help">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
        <div className="login-help" style={{ marginTop: 8 }}>
          Are you a parent/guardian? <Link href="/signup/parent">Parent signup</Link>
        </div>
      </div>
    </div>
  );
}
