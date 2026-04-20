"use client";

import { useState, useTransition, useRef } from "react";
import { uploadApplicantDocument, deleteApplicantDocument } from "@/lib/applicant-documents-actions";
import type { ApplicantDocumentKind } from "@prisma/client";

type DocKind = Extract<ApplicantDocumentKind, "COURSE_OUTLINE" | "FIRST_CLASS_PLAN">;

type DocEntry = {
  id: string;
  kind: ApplicantDocumentKind;
  fileUrl: string;
  originalName: string | null;
  uploadedAt: Date | string;
  supersededAt: Date | string | null;
};

type UploadResponse = {
  url?: string;
  originalName?: string;
  size?: number;
  error?: string;
};

interface ApplicantDocumentsPanelProps {
  applicationId: string;
  documents: DocEntry[];
  canUpload?: boolean;
  canDelete?: boolean;
}

const KIND_META: Record<DocKind, { label: string; hint: string }> = {
  COURSE_OUTLINE: {
    label: "Course Outline",
    hint: "PDF or Word doc - course overview, objectives, and session breakdown.",
  },
  FIRST_CLASS_PLAN: {
    label: "First Class Plan",
    hint: "PDF or Word doc - detailed plan for the first session.",
  },
};

const KINDS: DocKind[] = ["COURSE_OUTLINE", "FIRST_CLASS_PLAN"];

export default function ApplicantDocumentsPanel({
  applicationId,
  documents,
  canUpload = false,
  canDelete = false,
}: ApplicantDocumentsPanelProps) {
  const [localDocs, setLocalDocs] = useState<DocEntry[]>(documents);
  const [expandedHistory, setExpandedHistory] = useState<Record<DocKind, boolean>>({
    COURSE_OUTLINE: false,
    FIRST_CLASS_PLAN: false,
  });
  const [errors, setErrors] = useState<Record<DocKind, string | null>>({
    COURSE_OUTLINE: null,
    FIRST_CLASS_PLAN: null,
  });
  const [isPending, startTransition] = useTransition();
  const inputRefs = useRef<Record<DocKind, HTMLInputElement | null>>({
    COURSE_OUTLINE: null,
    FIRST_CLASS_PLAN: null,
  });

  function activeDoc(kind: DocKind): DocEntry | undefined {
    return localDocs.find((d) => d.kind === kind && !d.supersededAt);
  }

  function historyDocs(kind: DocKind): DocEntry[] {
    return localDocs.filter((d) => d.kind === kind && d.supersededAt);
  }

  function handleFileSelect(kind: DocKind, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [kind]: "File exceeds 10 MB limit." }));
      return;
    }
    setErrors((prev) => ({ ...prev, [kind]: null }));

    startTransition(async () => {
      try {
        const uploadFormData = new FormData();
        uploadFormData.set("file", file);
        uploadFormData.set("category", "OTHER");
        uploadFormData.set("entityId", applicationId);
        uploadFormData.set("entityType", "INSTRUCTOR_APPLICATION_DOCUMENT");

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadPayload = (await uploadResponse.json().catch(() => ({}))) as UploadResponse;

        if (!uploadResponse.ok || !uploadPayload.url) {
          throw new Error(uploadPayload.error ?? "Upload failed.");
        }
        const uploadedUrl = uploadPayload.url;
        const uploadedName = uploadPayload.originalName ?? file.name;

        const formData = new FormData();
        formData.set("applicationId", applicationId);
        formData.set("kind", kind);
        formData.set("fileUrl", uploadedUrl);
        formData.set("originalName", uploadedName);
        formData.set("fileSize", String(uploadPayload.size ?? file.size));

        const result = await uploadApplicantDocument(formData);
        if (!result.success) {
          throw new Error(result.error ?? "Document could not be saved.");
        }

        // Optimistic local update — full refresh happens via revalidatePath server-side
        const nowStr = new Date().toISOString();
        setLocalDocs((prev) => {
          const superseded = prev.map((d) =>
            d.kind === kind && !d.supersededAt ? { ...d, supersededAt: nowStr } : d
          );
          return [
            ...superseded,
            {
              id: `tmp-${Date.now()}`,
              kind,
              fileUrl: uploadedUrl,
              originalName: uploadedName,
              uploadedAt: nowStr,
              supersededAt: null,
            },
          ];
        });
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [kind]: err instanceof Error ? err.message : "Upload failed.",
        }));
      }
    });
  }

  function handleDelete(doc: DocEntry) {
    const formData = new FormData();
    formData.set("documentId", doc.id);
    startTransition(async () => {
      try {
        const result = await deleteApplicantDocument(formData);
        if (!result.success) {
          throw new Error(result.error ?? "Document could not be removed.");
        }
        const nowStr = new Date().toISOString();
        setLocalDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, supersededAt: nowStr } : d))
        );
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [doc.kind === "COURSE_OUTLINE" ? "COURSE_OUTLINE" : "FIRST_CLASS_PLAN"]:
            err instanceof Error ? err.message : "Remove failed.",
        }));
      }
    });
  }

  return (
    <div className="cockpit-documents-panel">
      {KINDS.map((kind) => {
        const meta = KIND_META[kind];
        const active = activeDoc(kind);
        const history = historyDocs(kind);
        const err = errors[kind];

        return (
          <div
            key={kind}
            className={`cockpit-document-card${active ? " is-complete" : " is-missing"}`}
          >
            <div className="cockpit-document-header">
              <div>
                <div className="cockpit-document-title">{meta.label}</div>
                <div className="cockpit-document-hint">{meta.hint}</div>
              </div>
              {active ? (
                <span className="pill pill-success pill-small">Uploaded</span>
              ) : (
                <span className="pill pill-attention pill-small">Missing</span>
              )}
            </div>

            {active && (
              <div
                className="cockpit-document-file"
              >
                <a
                  href={active.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cockpit-text-link"
                >
                  {active.originalName ?? "View document"}
                </a>
                <div className="cockpit-document-actions">
                  <span>
                    {new Date(active.uploadedAt).toLocaleDateString()}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      className="button small outline"
                      onClick={() => handleDelete(active)}
                      disabled={isPending}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            {canUpload && (
              <div className="cockpit-document-upload">
                <input
                  ref={(el: HTMLInputElement | null) => { inputRefs.current[kind] = el; }}
                  type="file"
                  accept="application/pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(kind, file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="button small secondary"
                  disabled={isPending}
                  onClick={() => inputRefs.current[kind]?.click()}
                >
                  {active ? "Re-upload" : "Upload"}
                </button>
              </div>
            )}

            {err && (
              <p className="cockpit-form-error">{err}</p>
            )}

            {history.length > 0 && (
              <div className="cockpit-document-history">
                <button
                  type="button"
                  className="cockpit-plain-button"
                  onClick={() =>
                    setExpandedHistory((prev) => ({ ...prev, [kind]: !prev[kind] }))
                  }
                >
                  {expandedHistory[kind] ? "Hide" : "Show"} {history.length} prior version{history.length > 1 ? "s" : ""}
                </button>
                {expandedHistory[kind] && (
                  <div className="cockpit-document-history-list">
                    {history.map((d) => (
                      <div
                        key={d.id}
                        className="cockpit-document-history-item"
                      >
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="cockpit-text-link"
                        >
                          {d.originalName ?? "Document"}
                        </a>
                        <span>|</span>
                        <span>superseded {new Date(d.supersededAt!).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
