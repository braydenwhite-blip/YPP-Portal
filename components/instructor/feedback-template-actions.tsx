"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Copies a feedback template to the clipboard. The template body is passed in
 * directly so the clipboard write happens synchronously inside the click
 * gesture (reliable across browsers); usage tracking is fired best-effort.
 */
export function CopyFeedbackTemplateButton({
  templateId,
  content,
  variant = "secondary",
}: {
  templateId: string;
  content: string;
  variant?: "primary" | "secondary";
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCopy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      void fetch("/api/feedback-templates/use", {
        method: "POST",
        body: new URLSearchParams({ templateId }),
      }).catch(() => {});
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2500);
    }
  }

  return (
    <button
      type="button"
      className={`button ${variant} small`}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? "Copied ✓" : failed ? "Copy failed" : "Copy"}
    </button>
  );
}

/** Deletes a feedback template after an explicit confirmation. */
export function DeleteFeedbackTemplateButton({
  templateId,
}: {
  templateId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this feedback template? This can't be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/feedback-templates/delete", {
        method: "POST",
        body: new URLSearchParams({ templateId }),
      });
      if (!res.ok) throw new Error("Request failed");
      router.push("/instructor/feedback-templates");
      router.refresh();
    } catch {
      setDeleting(false);
      window.alert("Could not delete the template. Please try again.");
    }
  }

  return (
    <button
      type="button"
      className="button danger small"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? "Deleting…" : "Delete template"}
    </button>
  );
}
