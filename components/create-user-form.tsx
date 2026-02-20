"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { RoleType } from "@prisma/client";
import { createUser } from "@/lib/admin-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create User"}
    </button>
  );
}

export function CreateUserForm({
  chapters,
}: {
  chapters: Array<{ id: string; name: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    try {
      await createUser(formData);
      setSuccess(true);
      // Reset form
      const form = document.getElementById("create-user-form") as HTMLFormElement;
      form?.reset();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form id="create-user-form" action={handleSubmit} className="form-grid">
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "14px",
            marginBottom: "12px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#d1fae5",
            border: "1px solid #10b981",
            borderRadius: "6px",
            color: "#065f46",
            fontSize: "14px",
            marginBottom: "12px",
          }}
        >
          <strong>Success!</strong> User created successfully.
        </div>
      )}
      <label className="form-row">
        Name
        <input className="input" name="name" required />
      </label>
      <label className="form-row">
        Email
        <input className="input" name="email" type="email" required />
      </label>
      <label className="form-row">
        Phone
        <input className="input" name="phone" />
      </label>
      <label className="form-row">
        Password
        <input className="input" name="password" type="password" required />
      </label>
      <label className="form-row">
        Primary Role
        <select className="input" name="primaryRole" defaultValue={RoleType.STUDENT}>
          {Object.values(RoleType).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row">
        Chapter
        <select className="input" name="chapterId" defaultValue="">
          <option value="">No chapter</option>
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        Additional Roles
        <div className="checkbox-grid">
          {Object.values(RoleType).map((role) => (
            <label key={role} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="roles" value={role} />
              {role}
            </label>
          ))}
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
