"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitInstructorApplicationForExistingUser } from "@/lib/signup-actions";
import type { SignupFormState } from "@/lib/signup-form-utils";
import {
  clearInstructorSignupDraft,
  loadInstructorSignupDraft,
} from "@/lib/instructor-signup-draft";

const initialState: SignupFormState = { status: "idle", message: "" };

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

interface Props {
  /** Track to render. Mirrors the signup page; for now Summer Workshop only. */
  isSummerWorkshop: boolean;
  /** Pre-fill values from the prior application to save the user re-typing. */
  prefill: Record<string, string | number | null | undefined>;
}

export default function ReapplyForm({ isSummerWorkshop, prefill }: Props) {
  const [state, action] = useFormState(
    submitInstructorApplicationForExistingUser,
    initialState
  );
  const router = useRouter();

  // If the applicant has no prior submitted application, the signed-out
  // /signup/instructor banner promised "we kept everything you typed on
  // this device" before bouncing them through sign-in. Honor that promise
  // by reading the localStorage draft and applying it as fallback prefill.
  // We never override server-side prefill from a real prior application.
  const hasPriorApplication = Object.values(prefill).some(
    (v) => v != null && v !== ""
  );
  const [localDraftFields, setLocalDraftFields] = useState<Record<string, string>>({});
  // Form key bumps once the draft loads so `defaultValue` inputs remount with
  // the draft values (DOM defaultValue only applies on initial mount).
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (hasPriorApplication) return;
    const draft = loadInstructorSignupDraft();
    if (draft && draft.fields && Object.keys(draft.fields).length > 0) {
      setLocalDraftFields(draft.fields);
      setFormKey((k) => k + 1);
    }
  }, [hasPriorApplication]);

  // After a successful submit, send the applicant to /application-status
  // (their account is already signed in — no auto-login dance needed).
  // Clear the localStorage draft so we don't repopulate it on a subsequent
  // re-application after this one is closed.
  useEffect(() => {
    if (state.status === "success" && state.message === "APPLICATION_SUBMITTED") {
      clearInstructorSignupDraft();
      router.push("/application-status");
      router.refresh();
    }
  }, [state.status, state.message, router]);

  const sf = state.fields ?? {};
  const get = (key: string) => {
    // Precedence: latest server submission > prior application prefill >
    // localStorage draft (fallback for net-new users mid-flow).
    const v = sf[key];
    if (typeof v === "string" && v !== "") return v;
    const fromPrefill = prefill[key];
    if (fromPrefill != null && fromPrefill !== "") return String(fromPrefill);
    const fromLocal = localDraftFields[key];
    return typeof fromLocal === "string" && fromLocal !== "" ? fromLocal : undefined;
  };

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

  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>(() => {
    const raw = get("availability");
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  });

  const [hearAbout, setHearAbout] = useState(() => get("hearAboutYPPOption") ?? "");
  const [hearAboutDetail, setHearAboutDetail] = useState(() => get("hearAboutYPPDetail") ?? "");
  // Re-sync the hearAbout state when the local draft loads (after initial mount).
  useEffect(() => {
    if (Object.keys(localDraftFields).length === 0) return;
    setHearAbout(get("hearAboutYPPOption") ?? "");
    setHearAboutDetail(get("hearAboutYPPDetail") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);
  const hearAboutNeedsName =
    hearAbout === "A YPP staff member" || hearAbout === "A YPP student";
  const hearAboutNeedsDetail = hearAbout === "Other";
  const hearAboutCombined = hearAboutDetail.trim()
    ? `${hearAbout}: ${hearAboutDetail.trim()}`
    : hearAbout;

  return (
    <form key={formKey} action={action}>
      <input
        type="hidden"
        name="applicationTrack"
        value={isSummerWorkshop ? "SUMMER_WORKSHOP_INSTRUCTOR" : "STANDARD_INSTRUCTOR"}
      />
      <input type="hidden" name="hearAboutYPP" value={hearAboutCombined} />

      <div>
        <div style={SECTION_STYLE}>Personal details</div>

        {!isSummerWorkshop && (
          <label className="form-label">
            Legal name
            <input className="input" name="legalName" required defaultValue={get("legalName")} />
          </label>
        )}

        <label className="form-label">
          Preferred first name
          <input
            className="input"
            name="preferredFirstName"
            required
            defaultValue={get("preferredFirstName")}
          />
        </label>

        <div className="grid two">
          <label className="form-label">
            Phone number <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            <input
              className="input"
              name="phoneNumber"
              type="tel"
              defaultValue={get("phoneNumber")}
            />
          </label>
          <label className="form-label">
            Date of birth <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            <input
              className="input"
              name="dateOfBirth"
              type="date"
              defaultValue={get("dateOfBirth")}
            />
          </label>
        </div>

        <label className="form-label">
          How did you hear about YPP? <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
          <select
            className="input"
            name="hearAboutYPPOption"
            value={hearAbout}
            onChange={(e) => {
              setHearAbout(e.target.value);
              setHearAboutDetail("");
            }}
          >
            <option value="">Select one</option>
            <option value="Word of mouth">Word of mouth</option>
            <option value="TikTok">TikTok</option>
            <option value="Instagram">Instagram</option>
            <option value="A YPP staff member">A YPP staff member</option>
            <option value="A YPP student">A YPP student</option>
            <option value="Other">Other</option>
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

      <div>
        <div style={SECTION_STYLE}>Location and school</div>

        <div className="grid two">
          <label className="form-label">
            City
            <input className="input" name="city" required defaultValue={get("city")} />
          </label>
          <label className="form-label">
            State or province
            <input
              className="input"
              name="stateProvince"
              required
              defaultValue={get("stateProvince")}
            />
          </label>
        </div>

        <div className="grid two">
          <label className="form-label">
            ZIP or postal code
            <input className="input" name="zipCode" required defaultValue={get("zipCode")} />
          </label>
          <label className="form-label">
            Country
            <select
              className="input"
              name="country"
              defaultValue={get("country") ?? "United States"}
              required
            >
              <option value="United States">United States</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <label className="form-label">
          High school name
          <input className="input" name="schoolName" required defaultValue={get("schoolName")} />
        </label>

        <label className="form-label">
          Graduation year
          <input
            className="input"
            name="graduationYear"
            type="number"
            min={2025}
            max={2030}
            required
            defaultValue={get("graduationYear")}
          />
        </label>

        <label className="form-label">
          Subjects of interest <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
          <input
            className="input"
            name="subjectsOfInterest"
            defaultValue={get("subjectsOfInterest")}
          />
        </label>
      </div>

      <hr style={HR} />

      <div>
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
                : undefined
            }
            defaultValue={get("teachingExperience")}
          />
        </label>

        {!isSummerWorkshop && (
          <>
            <label className="form-label">
              What class would you like to teach?
              <input
                className="input"
                name="courseIdea"
                required
                defaultValue={get("courseIdea")}
              />
            </label>

            <label className="form-label">
              Rough course outline
              <textarea
                className="input"
                name="courseOutline"
                rows={5}
                required
                defaultValue={get("courseOutline")}
              />
            </label>

            <label className="form-label">
              First-session sketch
              <textarea
                className="input"
                name="firstClassPlan"
                rows={5}
                required
                defaultValue={get("firstClassPlan")}
              />
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
            Optional written motivation
            <textarea
              className="input"
              name="motivation"
              rows={3}
              defaultValue={get("motivation")}
            />
          </label>
        )}
      </div>

      <hr style={HR} />

      <div>
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
                required
                defaultValue={get("availability")}
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
                  defaultValue={get("hoursPerWeek")}
                />
              </label>
              <label className="form-label">
                Preferred start date <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
                <input
                  className="input"
                  name="preferredStartDate"
                  type="date"
                  defaultValue={get("preferredStartDate")}
                />
              </label>
            </div>

            <label className="form-label">
              Referral emails <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
              <textarea
                className="input"
                name="referralEmails"
                rows={3}
                defaultValue={get("referralEmails")}
              />
            </label>
          </>
        )}
      </div>

      {state.status === "error" && state.message && (
        <div className="form-error" style={{ marginTop: 16 }}>
          {state.message}
        </div>
      )}

      <SubmitButton
        label={isSummerWorkshop ? "Send it →" : "Submit Re-Application"}
      />
    </form>
  );
}
