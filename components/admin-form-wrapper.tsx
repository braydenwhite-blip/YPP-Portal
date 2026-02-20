"use client";

import { useFormStatus } from "react-dom";
import { useState, useTransition } from "react";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}

export function AdminFormWrapper({
  action,
  children,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        if (onSuccess) {
          onSuccess();
        }
        // Reset form
        const form = document.querySelector("form") as HTMLFormElement;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="form-grid">
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      {children}
      <SubmitButton>Submit</SubmitButton>
    </form>
  );
}
