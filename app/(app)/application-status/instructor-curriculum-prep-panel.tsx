"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import FileUpload from "@/components/file-upload";
import { uploadApplicantDocument } from "@/lib/applicant-documents-actions";
import type { ApplicantDocumentKind } from "@prisma/client";

type UploadedFile = {
  id: string;
  url: string;
  originalName: string;
  size: number;
};

type ApplicantDocument = {
  id: string;
  kind: ApplicantDocumentKind;
  fileUrl: string;
  originalName: string | null;
  note: string | null;
  uploadedAt: string;
};

interface InstructorCurriculumPrepPanelProps {
  applicationId: string;
  documents: ApplicantDocument[];
}

export default function InstructorCurriculumPrepPanel({
  applicationId,
  documents,
}: InstructorCurriculumPrepPanelProps) {
  const router = useRouter();
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [structureNotes, setStructureNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const existingFirstClassPlan = useMemo(
    () => documents.find((doc) => doc.kind === "FIRST_CLASS_PLAN") ?? null,
    [documents]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const notes = structureNotes.trim();
    if (!uploadedFile) {
      setError("Upload your one-class plan before saving this prep item.");
      return;
    }
    if (!notes) {
      setError("Add a few notes about the overall curriculum structure.");
      return;
    }

    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("kind", "FIRST_CLASS_PLAN");
    formData.set("fileUrl", uploadedFile.url);
    formData.set("originalName", uploadedFile.originalName);
    formData.set("fileSize", String(uploadedFile.size));
    formData.set("note", notes);

    startTransition(async () => {
      const result = await uploadApplicantDocument(formData);
      if (!result.success) {
        setError(result.error ?? "We could not save that plan yet.");
        return;
      }

      setMessage("Saved. Your reviewer can see this plan and your structure notes.");
      setStructureNotes("");
      setUploadedFile(null);
      router.refresh();
    });
  }

  return (
    <section
      style={{
        marginBottom: 18,
        padding: "16px",
        borderRadius: 12,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Optional: Upload a Class Plan
          </h3>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
            Training unlocks after final instructor approval. If you have a more detailed class plan or supporting materials you would like your reviewer to see, you can upload them here.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div>
            <label className="form-label">One-class plan</label>
            <FileUpload
              category="OTHER"
              entityId={applicationId}
              entityType="INSTRUCTOR_APPLICATION_CLASS_PLAN"
              accept="application/pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              maxSizeMB={10}
              label={existingFirstClassPlan ? "Replace class plan" : "Upload class plan"}
              onUploadComplete={setUploadedFile}
              currentFileUrl={existingFirstClassPlan?.fileUrl ?? null}
            />
          </div>

          <div>
            <label htmlFor="curriculum-structure-notes" className="form-label">
              Overall structure notes
            </label>
            <textarea
              id="curriculum-structure-notes"
              className="input"
              rows={4}
              value={structureNotes}
              onChange={(event) => setStructureNotes(event.target.value)}
              placeholder="Example: 6 weeks, first session builds trust, middle sessions practice budgeting, final session shares student projects."
            />
          </div>

          {existingFirstClassPlan ? (
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              <a href={existingFirstClassPlan.fileUrl} target="_blank" rel="noreferrer">
                {existingFirstClassPlan.originalName ?? "View current class plan"}
              </a>
              {existingFirstClassPlan.note ? (
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                  {existingFirstClassPlan.note}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}
          {message ? (
            <p style={{ color: "#16a34a", fontSize: 13, margin: 0 }}>{message}</p>
          ) : null}

          <button type="submit" className="button" disabled={isPending}>
            {isPending ? "Saving…" : "Save Plan & Notes"}
          </button>
        </form>
      </div>
    </section>
  );
}
