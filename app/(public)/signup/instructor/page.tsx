"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
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
import { signUp } from "@/lib/signup-actions";
import type { SignupFormState } from "@/lib/signup-form-utils";

const initialState: SignupFormState = { status: "idle" as const, message: "" };

/** Submit button bound to the parent <form>'s pending state via useFormStatus. */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="button"
      type="submit"
      style={{ marginTop: 24, width: "100%" }}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "Submitting…" : label}
    </button>
  );
}

const SECTION_LABELS = ["Account", "Profile", "School", "Teaching", "Availability"] as const;

const AVAILABILITY_OPTIONS = [
  "Weekday mornings",
  "Weekday afternoons",
  "After school",
  "Weekday evenings",
  "Saturday mornings",
  "Saturday afternoons",
  "Sunday mornings",
  "Sunday afternoons",
  "School holidays",
  "Summer",
  "Flexible",
] as const;

type ApplicationTrackOption = "STANDARD_INSTRUCTOR" | "SUMMER_WORKSHOP_INSTRUCTOR";

/**
 * Mirrors the server-side `isRegularInstructorEnabled()` flag for use in
 * client components. Set `NEXT_PUBLIC_ENABLE_REGULAR_INSTRUCTOR=true` to
 * restore the standard Instructor track in the signup UI. The server-side
 * flag in `lib/feature-flags.ts` is the source of truth — this only
 * controls visibility of the radio.
 */
const REGULAR_INSTRUCTOR_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_REGULAR_INSTRUCTOR === "true";

const HEAR_ABOUT_OPTIONS = [
  "Word of mouth",
  "TikTok",
  "Instagram",
  "A YPP staff member",
  "A YPP student",
  "Other",
] as const;

function timeHint(section: number, summerWorkshop = false): string {
  if (summerWorkshop) {
    const hints: Record<number, string> = {
      1: "About 4–5 minutes left. You can leave and come back. We save your answers on this device.",
      2: "About 3 minutes left.",
      3: "About 2 minutes left.",
      4: "About 1 minute left.",
      5: "Almost done.",
    };
    return hints[section] ?? hints[5];
  }
  const hints: Record<number, string> = {
    1: "About 8–12 minutes left from here. You can leave and come back. We save your answers on this device.",
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
  const [password, setPassword] = useState("");

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
  const [applicationTrack, setApplicationTrack] = useState<ApplicationTrackOption>(() => {
    const fromState = field(d, "applicationTrack", sf) as ApplicationTrackOption | undefined;
    if (!REGULAR_INSTRUCTOR_ENABLED) return "SUMMER_WORKSHOP_INSTRUCTOR";
    return fromState ?? "STANDARD_INSTRUCTOR";
  });
  const isSummerWorkshop = applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR";
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>(() => {
    const raw = field(appliedDraft, "availability", state.fields);
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  });

  useEffect(() => {
    setHearAbout(field(d, "hearAboutYPPOption", sf) ?? "");
    setHearAboutDetail(field(d, "hearAboutYPPDetail", sf) ?? "");
    setApplicationTrack(
      !REGULAR_INSTRUCTOR_ENABLED
        ? "SUMMER_WORKSHOP_INSTRUCTOR"
        : (field(d, "applicationTrack", sf) as ApplicationTrackOption | undefined) ?? "STANDARD_INSTRUCTOR"
    );
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, alignItems: "center" }}>
                <Link
                  href={`/login?callbackUrl=/application-status${emailRef.current ? `&email=${encodeURIComponent(emailRef.current)}` : ""}`}
                  className="button"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  Sign in with my password
                </Link>
                <Link
                  href={`/magic-link?callbackUrl=/application-status${emailRef.current ? `&email=${encodeURIComponent(emailRef.current)}` : ""}`}
                  className="button secondary"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  Email me a sign-in link
                </Link>
              </div>
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
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>
          {isSummerWorkshop ? "Apply to be a YPP Summer Workshop Instructor." : "Apply to become a YPP instructor."}
        </h1>

        {/* Track selector */}
        {!REGULAR_INSTRUCTOR_ENABLED ? (
          <input type="hidden" name="applicationTrack" value="SUMMER_WORKSHOP_INSTRUCTOR" />
        ) : (
        <div style={{ marginBottom: 24 }}>
          <div style={SECTION_STYLE}>What are you applying for?</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(
              [
                {
                  value: "STANDARD_INSTRUCTOR" as const,
                  title: "Full Instructor",
                  blurb: "Design and teach a full YPP course over a semester or year. Includes a curriculum review and the full training pathway.",
                },
                {
                  value: "SUMMER_WORKSHOP_INSTRUCTOR" as const,
                  title: "Summer Workshop Instructor",
                  blurb: "Lead a focused, high-impact workshop at camp. A fast-start teaching role. Strong workshop instructors may quickly be considered for full instructor work and instructor mentorship.",
                },
              ]
            ).map((opt) => {
              const selected = applicationTrack === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "block",
                    padding: 14,
                    borderRadius: 10,
                    border: selected ? "2px solid #6b21c8" : "1px solid var(--border)",
                    background: selected ? "#f5f3ff" : "var(--background)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="applicationTrack"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setApplicationTrack(opt.value)}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{opt.title}</span>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>{opt.blurb}</p>
                </label>
              );
            })}
          </div>
        </div>
        )}

        {resumeBanner && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: 13, lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 10px" }}>
              We found a saved application on this device from{" "}
              {new Date(resumeBanner.savedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
              Your password is never stored. You will re-enter it before submitting.
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
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.45 }}>{timeHint(activeSection, isSummerWorkshop)}</p>
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
              Preferred name
              <input className="input" name="name" placeholder="What you'd like reviewers to call you" required defaultValue={field(d, "name", sf)} />
              <span style={HELPER}>
                This is the name we use across the portal. You&apos;ll provide your legal name separately in the next section.
              </span>
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
                value={password}
                onChange={(e) => {
                  const next = e.target.value;
                  setPassword(next);
                  passwordRef.current = next;
                }}
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

            {!isSummerWorkshop && (
              <label className="form-label">
                Legal name
                <input className="input" name="legalName" placeholder="First, middle, and last name" required defaultValue={field(d, "legalName", sf)} />
                <span style={HELPER}>
                  The name as it appears on your government ID. Used only for onboarding paperwork if you&apos;re hired. Not shown publicly.
                </span>
              </label>
            )}

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
            <div style={SECTION_STYLE}>{isSummerWorkshop ? "Workshop application" : "Teaching application"}</div>

            <label className="form-label">
              Teaching or mentoring experience
              <textarea
                className="input"
                name="teachingExperience"
                rows={isSummerWorkshop ? 2 : 4}
                required
                placeholder={
                  isSummerWorkshop
                    ? "Ever helped someone learn something? Tutoring, coaching, a club, babysitting. Tell us about it."
                    : "Walk us through the most relevant teaching, tutoring, coaching, camp, or mentoring experience you have. What did you lead, who were you working with, and what worked well?"
                }
                defaultValue={field(d, "teachingExperience", sf)}
              />
              {!isSummerWorkshop && (
                <span style={HELPER}>
                  Aim for 3–4 sentences (or a few bullets). Specific examples like a class, a club, a camp role, or a tutoring streak help reviewers more than general claims. Clear and concrete is what we&apos;re looking for.
                </span>
              )}
            </label>

            {!isSummerWorkshop && (
              <>
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
              </>
            )}

            {isSummerWorkshop && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: 13, color: "#5b21b6", marginTop: 12 }}>
                You&apos;ll design your full workshop with us after you&apos;re in. No curriculum needed upfront.
              </div>
            )}

            {!isSummerWorkshop && (
              <label className="form-label">
                Anything else you&apos;d like us to know? <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
                <textarea
                  className="input"
                  name="motivation"
                  rows={3}
                  placeholder="Why this opportunity matters to you, context the review team should consider, or anything you couldn't fit above."
                  defaultValue={field(d, "motivation", sf)}
                />
              </label>
            )}
          </div>

          <hr style={HR} />

          {/* ── 5. Availability ── */}
          <div data-signup-section="5">
            <div style={SECTION_STYLE}>Availability</div>

            {isSummerWorkshop ? (
              <>
                <input type="hidden" name="availability" value={availabilitySlots.join(", ")} />
                <div className="form-label" style={{ marginBottom: 8 }}>When are you generally free?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const selected = availabilitySlots.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setAvailabilitySlots((prev) =>
                            selected ? prev.filter((s) => s !== opt) : [...prev, opt]
                          )
                        }
                        style={{
                          padding: "8px 16px",
                          borderRadius: 20,
                          border: selected ? "2px solid #6b21c8" : "1px solid var(--border)",
                          background: selected ? "#f5f3ff" : "var(--background)",
                          color: selected ? "#6b21c8" : "var(--foreground)",
                          fontSize: 13,
                          fontWeight: selected ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
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
                  References <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
                  <textarea
                    className="input"
                    name="referralEmails"
                    rows={3}
                    placeholder="name@example.com, Teacher, How they know you"
                    defaultValue={field(d, "referralEmails", sf)}
                  />
                  <span style={HELPER}>
                    Emails of 1–2 people who can speak to your teaching, mentoring, or leadership: a teacher, coach, supervisor, club advisor, or chapter leader. Friends and family aren&apos;t a fit. We only reach out if we&apos;re moving forward with your application, and we&apos;ll let you know first.
                  </span>
                </label>
              </>
            )}
          </div>

          {state.status === "error" && state.message === "ACCOUNT_EXISTS_SIGNIN_REQUIRED" ? (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: 10,
                background: "#fef3c7",
                border: "1px solid #fde68a",
                fontSize: 13,
                lineHeight: 1.55,
                color: "#78350f",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                You already have an account with this email.
              </strong>
              We&apos;ve kept everything you typed on this device. Sign in and we&apos;ll
              take you to a page where you can finish or update your application.
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <Link
                  href="/login?callbackUrl=/applications/instructor/new"
                  className="button"
                  style={{ fontSize: 13, padding: "8px 14px", textDecoration: "none" }}
                >
                  Sign in to continue
                </Link>
                <Link
                  href="/magic-link?callbackUrl=/applications/instructor/new"
                  className="button secondary"
                  style={{ fontSize: 13, padding: "8px 14px", textDecoration: "none" }}
                >
                  Email me a sign-in link
                </Link>
              </div>
            </div>
          ) : state.message && state.message !== "APPLICATION_SUBMITTED" ? (
            (() => {
              const lines = state.message.split("\n").filter((line) => line.trim().length > 0);
              const className = state.status === "error" ? "form-error" : "form-success";
              if (lines.length <= 1) {
                return (
                  <div className={className} style={{ marginTop: 16 }}>
                    {state.message}
                  </div>
                );
              }
              return (
                <div className={className} role="alert" style={{ marginTop: 16 }}>
                  <strong style={{ display: "block", marginBottom: 6 }}>
                    Please fix the following before submitting:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {lines.map((line, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>{line}</li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : null}

          <SubmitButton
            label={isSummerWorkshop ? "Send it →" : "Submit Application"}
          />
        </form>

        <div className="login-help" style={{ marginTop: 24 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
