"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";

import ApplicantVideoUpload from "@/components/applicant-video-upload";
import BrandLockup from "@/components/brand-lockup";
import { signUp } from "@/lib/signup-actions";

const initialState = { status: "idle" as const, message: "" };

export default function InstructorSignupPage() {
  const [state, formAction] = useFormState(signUp, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [motivationVideoUrl, setMotivationVideoUrl] = useState("");
  const [motivationVideoUploading, setMotivationVideoUploading] = useState(false);

  useEffect(() => {
    async function loadChapters() {
      const response = await fetch("/api/chapters");
      if (!response.ok) return;
      const data = await response.json();
      setChapters(Array.isArray(data) ? data : []);
    }

    loadChapters();
  }, []);

  if (state.status === "success" && state.message === "APPLICATION_SUBMITTED") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Application Submitted
              </h1>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Your instructor application is in
              </p>
            </div>
          </div>

          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            We created your account and sent your instructor application to the review team. You can sign in any time to check your status.
          </p>

          <Link className="button" style={{ display: "block", textAlign: "center" }} href="/login">
            Go to Sign In
          </Link>
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

          <form action={formAction}>
            <input type="hidden" name="accountType" value="APPLICANT" />
            <input type="hidden" name="motivationVideoUrl" value={motivationVideoUrl} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Account
            </div>

            <label className="form-label" style={{ marginTop: 0 }}>
              Full name
              <input className="input" name="name" placeholder="Your full name" required />
            </label>

            <label className="form-label">
              Email
              <input className="input" name="email" type="email" placeholder="you@example.com" required />
            </label>

            <label className="form-label">
              Password
              <input className="input" name="password" type="password" placeholder="Min 8 characters, letter + number" required />
            </label>

            <label className="form-label">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">Select a chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Personal details
            </div>

            <label className="form-label">
              Legal name
              <input className="input" name="legalName" placeholder="First, middle, and last name" required />
            </label>

            <label className="form-label">
              Preferred first name
              <input className="input" name="preferredFirstName" placeholder="What should we call you?" required />
            </label>

            <div className="grid two">
              <label className="form-label">
                Phone number
                <input className="input" name="phoneNumber" type="tel" placeholder="(555) 123-4567" />
              </label>
              <label className="form-label">
                Date of birth
                <input className="input" name="dateOfBirth" type="date" />
              </label>
            </div>

            <label className="form-label">
              How did you hear about YPP?
              <input className="input" name="hearAboutYPP" placeholder="Optional" />
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Location and school
            </div>

            <div className="grid two">
              <label className="form-label">
                City
                <input className="input" name="city" placeholder="e.g. Phoenix" required />
              </label>
              <label className="form-label">
                State or province
                <input className="input" name="stateProvince" placeholder="e.g. Arizona" required />
              </label>
            </div>

            <div className="grid two">
              <label className="form-label">
                ZIP or postal code
                <input className="input" name="zipCode" placeholder="e.g. 85004" required />
              </label>
              <label className="form-label">
                Country
                <select className="input" name="country" defaultValue="United States" required>
                  <option value="United States">United States</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="form-label">
              If you chose &quot;Other,&quot; which country?
              <input className="input" name="countryOther" placeholder="Optional" />
            </label>

            <label className="form-label">
              High school name
              <input className="input" name="schoolName" placeholder="Your school" required />
            </label>

            <div className="grid two">
              <label className="form-label">
                Graduation year
                <input className="input" name="graduationYear" type="number" min={2025} max={2030} placeholder="e.g. 2027" required />
              </label>
              <label className="form-label">
                GPA
                <input className="input" name="gpa" placeholder="Optional" />
              </label>
            </div>

            <label className="form-label">
              Class rank
              <input className="input" name="classRank" placeholder="Optional" />
            </label>

            <label className="form-label">
              Subjects of interest
              <input className="input" name="subjectsOfInterest" placeholder="Optional" />
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Teaching application
            </div>

            <label className="form-label">
              Why do you want to join YPP?
              <textarea className="input" name="whyYPP" rows={4} required />
            </label>

            <label className="form-label">
              Teaching or mentoring experience
              <textarea className="input" name="teachingExperience" rows={4} required />
            </label>

            <label className="form-label">
              Extracurricular activities and clubs
              <textarea className="input" name="extracurriculars" rows={3} required />
            </label>

            <label className="form-label">
              Prior leadership experience
              <textarea className="input" name="priorLeadership" rows={3} required />
            </label>

            <label className="form-label">
              Special skills or certifications
              <textarea className="input" name="specialSkills" rows={2} />
            </label>

            <label className="form-label">
              Teaching approach video
              <div style={{ marginTop: 8 }}>
                <ApplicantVideoUpload
                  onUploadComplete={(file) => setMotivationVideoUrl(file.url)}
                  onUploadStateChange={setMotivationVideoUploading}
                />
              </div>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Record a short video explaining how you teach, mentor, or structure learning.
              </span>
            </label>

            <label className="form-label">
              Optional written motivation
              <textarea className="input" name="motivation" rows={3} />
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Availability
            </div>

            <label className="form-label">
              Interview availability
              <input className="input" name="availability" placeholder="e.g. weekday evenings" required />
            </label>

            <div className="grid two">
              <label className="form-label">
                Hours per week you can commit
                <input className="input" name="hoursPerWeek" type="number" min={1} max={40} required />
              </label>
              <label className="form-label">
                Preferred start date
                <input className="input" name="preferredStartDate" type="date" />
              </label>
            </div>

            <label className="form-label">
              Referral emails
              <textarea className="input" name="referralEmails" rows={3} />
            </label>

            <label className="form-label">
              Race or ethnicity
              <input className="input" name="ethnicity" placeholder="Optional" />
            </label>

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
