"use client";

import { useState, useTransition, useRef } from "react";
import { uploadApplicantDocument, deleteApplicantDocument } from "@/lib/applicant-documents-actions";
import type { ApplicantDocumentKind } from "@prisma/client";
import { Button } from "@/components/ui-v2";

type DocKind = Extract<ApplicantDocumentKind, "COURSE_OUTLINE" | "FIRST_CLASS_PLAN">;

type DocEntry = {
  id: string;
  kind: ApplicantDocumentKind;
  fileUrl: string;
  originalName: string | null;
  note?: string | null;
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
    label: "Course Outline / Structure Notes",
    hint: "PDF, Word doc, or structure notes attached to the first class plan.",
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

  function firstClassPlanWithStructureNotes(): DocEntry | undefined {
    return localDocs.find(
      (d) =>
        d.kind === "FIRST_CLASS_PLAN" &&
        !d.supersededAt &&
        typeof d.note === "string" &&
        d.note.trim().length > 0
    );
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
    <div className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface p-[18px] shadow-card">
      {KINDS.map((kind) => {
        const meta = KIND_META[kind];
        const active = activeDoc(kind);
        const structureNotesDoc =
          kind === "COURSE_OUTLINE" && !active
            ? firstClassPlanWithStructureNotes()
            : undefined;
        const isComplete = Boolean(active || structureNotesDoc);
        const history = historyDocs(kind);
        const err = errors[kind];

        return (
          <div
            key={kind}
            className={`rounded-[10px] border px-3.5 py-3 ${isComplete ? "border-line-soft bg-surface-soft/60" : "border-amber-200 bg-amber-50/50"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[13.5px] font-bold text-ink">{meta.label}</div>
                <div className="text-[12px] text-ink-muted">{meta.hint}</div>
              </div>
              {isComplete ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {structureNotesDoc ? "Notes received" : "Uploaded"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Missing</span>
              )}
            </div>

            {active && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[12.5px]">
                <a
                  href={active.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  {active.originalName ?? "View document"}
                </a>
                <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <span>
                    {new Date(active.uploadedAt).toLocaleDateString()}
                  </span>
                  {canDelete && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(active)}
                      disabled={isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )}

            {structureNotesDoc ? (
              <div className="mt-2 rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[12.5px] text-ink-muted">
                <span>Structure notes were submitted with the first class plan.</span>
              </div>
            ) : null}

            {(active?.note || structureNotesDoc?.note) ? (
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-normal text-ink-muted">
                {active?.note ?? structureNotesDoc?.note}
              </p>
            ) : null}

            {canUpload && (
              <div className="mt-2">
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
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => inputRefs.current[kind]?.click()}
                >
                  {active ? "Re-upload" : "Upload"}
                </Button>
              </div>
            )}

            {err && (
              <p className="m-0 mt-1.5 text-[12.5px] font-semibold text-danger-700">{err}</p>
            )}

            {history.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-ink-muted underline hover:text-ink"
                  onClick={() =>
                    setExpandedHistory((prev) => ({ ...prev, [kind]: !prev[kind] }))
                  }
                >
                  {expandedHistory[kind] ? "Hide" : "Show"} {history.length} prior version{history.length > 1 ? "s" : ""}
                </button>
                {expandedHistory[kind] && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {history.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted"
                      >
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12.5px] font-semibold text-brand-700 hover:underline"
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
