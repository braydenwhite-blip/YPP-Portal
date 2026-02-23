"use client";

import { useState, useTransition } from "react";
import {
  createTrainingModuleWithVideo,
  updateTrainingModule,
} from "@/lib/training-actions";
import { TrainingModuleType, VideoProvider } from "@prisma/client";

interface Module {
  id: string;
  contentKey: string | null;
  title: string;
  description: string;
  materialUrl: string | null;
  materialNotes: string | null;
  type: string;
  required: boolean;
  sortOrder: number;
  videoUrl: string | null;
  videoProvider: string | null;
  videoDuration: number | null;
  videoThumbnail: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  passScorePct: number;
  estimatedMinutes: number | null;
}

interface ModuleFormProps {
  module: Module | null;
  onClose: () => void;
  nextSortOrder: number;
}

const MODULE_TYPE_DESCRIPTIONS: Record<string, string> = {
  WORKSHOP: "Live or structured learning session",
  SCENARIO_PRACTICE: "Practical scenario exercises",
  CURRICULUM_REVIEW: "Content review and study",
  RESOURCE: "Reference materials and links",
};

export default function ModuleForm({ module, onClose, nextSortOrder }: ModuleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (module) {
          await updateTrainingModule(formData);
        } else {
          await createTrainingModuleWithVideo(formData);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      {module && <input type="hidden" name="moduleId" value={module.id} />}

      {error && (
        <div className="form-error" style={{ margin: "0 0 4px" }}>
          {error}
        </div>
      )}

      {/* Basic Info */}
      <label className="form-row">
        Content Key{" "}
        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>
          (optional — for JSON sync)
        </span>
        <input
          className="input"
          name="contentKey"
          placeholder="academy_foundations_001"
          defaultValue={module?.contentKey ?? ""}
          disabled={isPending}
        />
      </label>

      <label className="form-row">
        Title <span style={{ color: "#dc2626" }}>*</span>
        <input
          className="input"
          name="title"
          required
          placeholder="e.g. Foundations of Youth Mentorship"
          defaultValue={module?.title ?? ""}
          disabled={isPending}
        />
      </label>

      <label className="form-row">
        Type
        <select
          className="input"
          name="type"
          defaultValue={module?.type ?? TrainingModuleType.WORKSHOP}
          disabled={isPending}
        >
          {Object.values(TrainingModuleType).map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")} — {MODULE_TYPE_DESCRIPTIONS[t] ?? ""}
            </option>
          ))}
        </select>
      </label>

      <label className="form-row">
        Description <span style={{ color: "#dc2626" }}>*</span>
        <textarea
          className="input"
          name="description"
          rows={3}
          required
          placeholder="What will learners get out of this module?"
          defaultValue={module?.description ?? ""}
          disabled={isPending}
        />
      </label>

      {/* Materials */}
      <div className="module-form-section">
        <p className="module-form-section-title">Materials</p>
        <div className="grid two">
          <label className="form-row">
            Material URL
            <input
              className="input"
              name="materialUrl"
              type="url"
              placeholder="https://docs.google.com/..."
              defaultValue={module?.materialUrl ?? ""}
              disabled={isPending}
            />
          </label>
          <label className="form-row">
            Material Notes
            <input
              className="input"
              name="materialNotes"
              placeholder="Slide deck, readings, etc."
              defaultValue={module?.materialNotes ?? ""}
              disabled={isPending}
            />
          </label>
        </div>
      </div>

      {/* Video */}
      <div className="module-form-section">
        <p className="module-form-section-title">Video</p>
        <div className="grid two">
          <label className="form-row">
            Video URL
            <input
              className="input"
              name="videoUrl"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              defaultValue={module?.videoUrl ?? ""}
              disabled={isPending}
            />
          </label>
          <label className="form-row">
            Provider
            <select
              className="input"
              name="videoProvider"
              defaultValue={module?.videoProvider ?? ""}
              disabled={isPending}
            >
              <option value="">None</option>
              {Object.values(VideoProvider).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid two">
          <label className="form-row">
            Duration (seconds)
            <input
              className="input"
              name="videoDuration"
              type="number"
              min={0}
              placeholder="e.g. 1800 for 30 min"
              defaultValue={module?.videoDuration ?? ""}
              disabled={isPending}
            />
          </label>
          <label className="form-row">
            Thumbnail URL
            <input
              className="input"
              name="videoThumbnail"
              type="url"
              placeholder="https://..."
              defaultValue={module?.videoThumbnail ?? ""}
              disabled={isPending}
            />
          </label>
        </div>
      </div>

      {/* Settings */}
      <div className="module-form-section">
        <p className="module-form-section-title">Settings</p>
        <div className="grid two">
          <label className="form-row">
            Estimated Time (minutes)
            <input
              className="input"
              name="estimatedMinutes"
              type="number"
              min={1}
              placeholder="e.g. 30"
              defaultValue={module?.estimatedMinutes ?? ""}
              disabled={isPending}
            />
          </label>
          <label className="form-row">
            Sort Order
            <input
              className="input"
              name="sortOrder"
              type="number"
              min={1}
              required
              defaultValue={module?.sortOrder ?? nextSortOrder}
              disabled={isPending}
            />
          </label>
        </div>
        <label className="form-row">
          Pass Score %
          <input
            className="input"
            name="passScorePct"
            type="number"
            min={1}
            max={100}
            defaultValue={module?.passScorePct ?? 80}
            disabled={isPending}
            style={{ maxWidth: 120 }}
          />
        </label>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              name="required"
              defaultChecked={module?.required ?? true}
              disabled={isPending}
            />
            Required module
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              name="requiresQuiz"
              defaultChecked={module?.requiresQuiz ?? false}
              disabled={isPending}
            />
            Requires quiz
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              name="requiresEvidence"
              defaultChecked={module?.requiresEvidence ?? false}
              disabled={isPending}
            />
            Requires evidence
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : module ? "Save Changes" : "Create Module"}
        </button>
        <button
          className="button outline"
          type="button"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
