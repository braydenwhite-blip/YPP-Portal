"use client";

import { useState } from "react";
import { useFormState } from "react-dom";

import type { ManagedStudentFormState } from "@/lib/parent-actions";
import {
  archiveManagedStudentAccount,
  updateManagedStudentProfile,
} from "@/lib/parent-actions";

const initialState: ManagedStudentFormState = {
  status: "idle",
  message: "",
};

type ParentStudentManagementPanelProps = {
  chapters: Array<{ id: string; name: string }>;
  student: {
    chapterId: string;
    email: string;
    id: string;
    name: string;
    phone: string | null;
    profile: {
      city: string | null;
      dateOfBirth: string | null;
      grade: number | null;
      school: string | null;
      stateProvince: string | null;
      usesParentPhone: boolean;
    };
  };
};

export default function ParentStudentManagementPanel({
  chapters,
  student,
}: ParentStudentManagementPanelProps) {
  const [updateState, updateAction] = useFormState(updateManagedStudentProfile, initialState);
  const [archiveState, archiveAction] = useFormState(archiveManagedStudentAccount, initialState);
  const [studentUsesParentPhone, setStudentUsesParentPhone] = useState(student.profile.usesParentPhone);

  return (
    <div className="grid two" style={{ alignItems: "start", marginBottom: 24 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Manage Student Info</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Parents can update the family-managed student details collected during signup.
        </p>

        <form action={updateAction}>
          <input type="hidden" name="studentId" value={student.id} />

          <label className="form-label" style={{ marginTop: 0 }}>
            Student full name
            <input className="input" name="studentName" defaultValue={student.name} required />
          </label>

          <label className="form-label">
            Student email
            <input className="input" name="studentEmail" type="email" defaultValue={student.email} required />
          </label>

          <div className="grid two">
            <label className="form-label">
              Student date of birth
              <input
                className="input"
                name="studentDateOfBirth"
                type="date"
                defaultValue={student.profile.dateOfBirth ?? ""}
                required
              />
            </label>
            <label className="form-label">
              Grade
              <input
                className="input"
                name="studentGrade"
                type="number"
                min={1}
                max={12}
                defaultValue={student.profile.grade ?? ""}
                required
              />
            </label>
          </div>

          <label className="form-label">
            Student school
            <input
              className="input"
              name="studentSchool"
              defaultValue={student.profile.school ?? ""}
              placeholder="e.g. Lincoln High School"
              required
            />
          </label>

          <label className="form-label">
            Student phone
            <input
              className="input"
              name="studentPhone"
              type="tel"
              defaultValue={student.profile.usesParentPhone ? "" : student.phone ?? ""}
              placeholder={studentUsesParentPhone ? "Using the parent phone number" : "(555) 123-4567"}
              disabled={studentUsesParentPhone}
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, fontSize: 13, color: "var(--muted)" }}>
            <input
              type="checkbox"
              name="studentUsesParentPhone"
              defaultChecked={student.profile.usesParentPhone}
              onChange={(event) => setStudentUsesParentPhone(event.target.checked)}
            />
            Use the parent phone number for the student too.
          </label>

          <div className="grid two">
            <label className="form-label">
              City
              <input className="input" name="city" defaultValue={student.profile.city ?? ""} required />
            </label>
            <label className="form-label">
              State
              <input className="input" name="stateProvince" defaultValue={student.profile.stateProvince ?? ""} required />
            </label>
          </div>

          <label className="form-label">
            Chapter
            <select className="input" name="chapterId" defaultValue={student.chapterId} required>
              <option value="" disabled>
                Select a chapter
              </option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>

          {updateState.message ? (
            <div className={updateState.status === "error" ? "form-error" : "form-success"}>
              {updateState.message}
            </div>
          ) : null}

          <button type="submit" className="button">
            Save Student Info
          </button>
        </form>
      </div>

      <div className="card" style={{ borderLeft: "4px solid #dc2626" }}>
        <h3 style={{ marginTop: 0 }}>Archive Family Setup</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          This archives the student account and removes the parent-student family setup from active use.
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          To confirm, type the student&apos;s exact email address below.
        </p>

        <form action={archiveAction}>
          <input type="hidden" name="studentId" value={student.id} />

          <label className="form-label" style={{ marginTop: 0 }}>
            Confirm student email
            <input
              className="input"
              name="confirmStudentEmail"
              type="email"
              placeholder={student.email}
              required
            />
          </label>

          {archiveState.message ? (
            <div className={archiveState.status === "error" ? "form-error" : "form-success"}>
              {archiveState.message}
            </div>
          ) : null}

          <button type="submit" className="button secondary" style={{ width: "100%" }}>
            Archive Student Account
          </button>
        </form>
      </div>
    </div>
  );
}
