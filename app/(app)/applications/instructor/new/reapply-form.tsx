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

        <label className="form-label">
          Legal name
          <input className="input" name="legalName" required defaultValue={get("legalName")} />
        </label>

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
            rows={isSummerWorkshop ? 3 : 4}
            required
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
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Workshop Outline
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Sketch one short workshop you&apos;d run at a camp. Replaces the full
              course outline. Most workshops are in person — use the materials
              section to note space, supply, or safety needs.
            </p>

            <label className="form-label">
              Workshop title
              <input
                className="input"
                name="workshopTitle"
                required
                defaultValue={get("workshopTitle")}
              />
            </label>

            <div className="grid two">
              <label className="form-label">
                Age range
                <input
                  className="input"
                  name="workshopAgeRange"
                  required
                  defaultValue={get("workshopAgeRange")}
                />
              </label>
              <label className="form-label">
                Duration (minutes)
                <input
                  className="input"
                  name="workshopDurationMinutes"
                  type="number"
                  min={15}
                  max={240}
                  required
                  defaultValue={get("workshopDurationMinutes")}
                />
              </label>
            </div>

            <label className="form-label">
              Learning goals
              <textarea
                className="input"
                name="workshopLearningGoals"
                rows={3}
                required
                defaultValue={get("workshopLearningGoals")}
              />
              <span style={HELPER}>One per line.</span>
            </label>

            <label className="form-label">
              Activity flow
              <textarea
                className="input"
                name="workshopActivityFlow"
                rows={4}
                required
                defaultValue={get("workshopActivityFlow")}
              />
            </label>

            <label className="form-label">
              Materials needed <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
              <textarea
                className="input"
                name="workshopMaterialsNeeded"
                rows={2}
                defaultValue={get("workshopMaterialsNeeded")}
              />
              <span style={HELPER}>
                One per line. Include supplies, space requirements, or any
                safety considerations.
              </span>
            </label>

            <label className="form-label">
              Engagement hook
              <textarea
                className="input"
                name="workshopEngagementHook"
                rows={3}
                required
                defaultValue={get("workshopEngagementHook")}
              />
            </label>

            <label className="form-label">
              Adapting on the fly
              <textarea
                className="input"
                name="workshopAdaptationNotes"
                rows={3}
                required
                defaultValue={get("workshopAdaptationNotes")}
              />
            </label>
          </div>
        )}

        <label className="form-label">
          {isSummerWorkshop ? "Optional motivation" : "Optional written motivation"}
          <textarea
            className="input"
            name="motivation"
            rows={3}
            defaultValue={get("motivation")}
          />
        </label>
      </div>

      <hr style={HR} />

      <div>
        <div style={SECTION_STYLE}>Availability</div>

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
      </div>

      {state.status === "error" && state.message && (
        <div className="form-error" style={{ marginTop: 16 }}>
          {state.message}
        </div>
      )}

      <SubmitButton
        label={
          isSummerWorkshop
            ? "Submit Workshop Instructor Re-Application"
            : "Submit Re-Application"
        }
      />
    </form>
  );
}
