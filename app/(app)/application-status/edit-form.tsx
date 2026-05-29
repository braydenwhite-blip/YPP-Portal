"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { editInstructorApplicationFields } from "@/lib/instructor-application-actions";

const initialState = { status: "idle" as const, message: "" };

function EditSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending} style={{ fontSize: 13 }}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

type WorkshopOutlineValues = {
  title: string;
  ageRange: string;
  durationMinutes: number | null;
  learningGoals: string[];
  activityFlow: string;
  materialsNeeded: string[];
  engagementHook: string;
  adaptationNotes: string;
} | null;

interface Props {
  /** Track determines which fields are visible. */
  isSummerWorkshop: boolean;
  /** Pre-fill values from the current application. */
  values: {
    motivation: string | null;
    teachingExperience: string;
    availability: string;
    hoursPerWeek: number | null;
    preferredStartDate: string | null;
    subjectsOfInterest: string | null;
    courseIdea: string | null;
    courseOutline: string | null;
    firstClassPlan: string | null;
    preferredFirstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    city: string | null;
    stateProvince: string | null;
    zipCode: string | null;
  };
  /** Existing workshop outline (Summer Workshop track only). */
  workshopOutline?: WorkshopOutlineValues;
}

export default function ApplicantEditForm({
  isSummerWorkshop,
  values,
  workshopOutline,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(editInstructorApplicationFields, initialState);

  if (!open) {
    return (
      <button
        type="button"
        className="button ghost"
        onClick={() => setOpen(true)}
        style={{ marginTop: 12, fontSize: 13 }}
      >
        Edit my answers
      </button>
    );
  }

  return (
    <form
      action={action}
      style={{ marginTop: 12, padding: 16, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)" }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>Update your answers</strong>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        You can update most of your answers while review is in progress. Identity
        and school fields are locked. Each edit is recorded — your original
        answers stay on file for the review team.
      </p>

      <div className="grid two">
        <label className="form-label">
          Preferred first name
          <input
            className="input"
            name="preferredFirstName"
            defaultValue={values.preferredFirstName ?? ""}
          />
        </label>
        <label className="form-label">
          Last name
          <input
            className="input"
            name="lastName"
            defaultValue={values.lastName ?? ""}
          />
        </label>
      </div>

      <label className="form-label">
        Phone number
        <input
          className="input"
          name="phoneNumber"
          type="tel"
          defaultValue={values.phoneNumber ?? ""}
        />
      </label>

      <div className="grid two">
        <label className="form-label">
          City
          <input className="input" name="city" defaultValue={values.city ?? ""} />
        </label>
        <label className="form-label">
          State or province
          <input
            className="input"
            name="stateProvince"
            defaultValue={values.stateProvince ?? ""}
          />
        </label>
      </div>

      <label className="form-label">
        ZIP or postal code
        <input className="input" name="zipCode" defaultValue={values.zipCode ?? ""} />
      </label>

      <label className="form-label">
        Subjects of interest
        <input
          className="input"
          name="subjectsOfInterest"
          defaultValue={values.subjectsOfInterest ?? ""}
        />
      </label>

      <label className="form-label">
        Teaching or mentoring experience
        <textarea
          className="input"
          name="teachingExperience"
          rows={4}
          defaultValue={values.teachingExperience}
        />
      </label>

      {!isSummerWorkshop && (
        <>
          <label className="form-label">
            What class would you like to teach?
            <input className="input" name="courseIdea" defaultValue={values.courseIdea ?? ""} />
          </label>
          <label className="form-label">
            Rough course outline
            <textarea
              className="input"
              name="courseOutline"
              rows={5}
              defaultValue={values.courseOutline ?? ""}
            />
          </label>
          <label className="form-label">
            First-session sketch
            <textarea
              className="input"
              name="firstClassPlan"
              rows={5}
              defaultValue={values.firstClassPlan ?? ""}
            />
          </label>
        </>
      )}

      {isSummerWorkshop && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--background)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Workshop outline
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.5 }}>
            Update the short workshop you&rsquo;d run at a camp. Most workshops are
            in person — note any space, materials, or safety needs in the relevant
            sections so reviewers can plan logistics.
          </p>

          <label className="form-label">
            Workshop title
            <input
              className="input"
              name="workshopTitle"
              defaultValue={workshopOutline?.title ?? ""}
            />
          </label>

          <div className="grid two">
            <label className="form-label">
              Age range
              <input
                className="input"
                name="workshopAgeRange"
                defaultValue={workshopOutline?.ageRange ?? ""}
                placeholder="e.g. Grades 6–8"
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
                defaultValue={workshopOutline?.durationMinutes ?? ""}
              />
            </label>
          </div>

          <label className="form-label">
            Learning goals
            <textarea
              className="input"
              name="workshopLearningGoals"
              rows={3}
              defaultValue={(workshopOutline?.learningGoals ?? []).join("\n")}
            />
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              One per line.
            </span>
          </label>

          <label className="form-label">
            Activity flow
            <textarea
              className="input"
              name="workshopActivityFlow"
              rows={4}
              defaultValue={workshopOutline?.activityFlow ?? ""}
            />
          </label>

          <label className="form-label">
            Materials needed (incl. supplies, space requirements, safety notes)
            <textarea
              className="input"
              name="workshopMaterialsNeeded"
              rows={3}
              defaultValue={(workshopOutline?.materialsNeeded ?? []).join("\n")}
            />
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              One per line. Optional but useful for the review team.
            </span>
          </label>

          <label className="form-label">
            Engagement hook
            <textarea
              className="input"
              name="workshopEngagementHook"
              rows={3}
              defaultValue={workshopOutline?.engagementHook ?? ""}
            />
          </label>

          <label className="form-label">
            Adapting on the fly
            <textarea
              className="input"
              name="workshopAdaptationNotes"
              rows={3}
              defaultValue={workshopOutline?.adaptationNotes ?? ""}
            />
          </label>
        </div>
      )}

      <label className="form-label">
        Motivation
        <textarea
          className="input"
          name="motivation"
          rows={3}
          defaultValue={values.motivation ?? ""}
        />
      </label>

      <label className="form-label">
        Interview availability
        <input
          className="input"
          name="availability"
          defaultValue={values.availability}
        />
      </label>

      <div className="grid two">
        <label className="form-label">
          Hours per week
          <input
            className="input"
            name="hoursPerWeek"
            type="number"
            min={1}
            max={40}
            defaultValue={values.hoursPerWeek ?? ""}
          />
        </label>
        <label className="form-label">
          Preferred start date
          <input
            className="input"
            name="preferredStartDate"
            type="date"
            defaultValue={values.preferredStartDate ?? ""}
          />
        </label>
      </div>

      {state.message && (
        <p
          style={{
            fontSize: 13,
            marginTop: 8,
            color: state.status === "error" ? "#dc2626" : "#15803d",
          }}
        >
          {state.message}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <EditSubmit />
        <button
          type="button"
          className="button ghost"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
    </form>
  );
}
