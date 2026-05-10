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
    phoneNumber: string | null;
    city: string | null;
    stateProvince: string | null;
    zipCode: string | null;
  };
}

export default function ApplicantEditForm({ isSummerWorkshop, values }: Props) {
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

      <label className="form-label">
        Preferred first name
        <input
          className="input"
          name="preferredFirstName"
          defaultValue={values.preferredFirstName ?? ""}
        />
      </label>

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
