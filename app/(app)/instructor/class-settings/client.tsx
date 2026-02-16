"use client";

import { useState } from "react";
import {
  createClassOffering,
  updateClassOffering,
  publishClassOffering,
} from "@/lib/class-management-actions";
import { useRouter } from "next/navigation";

interface TemplateOption {
  id: string;
  title: string;
  interestArea: string;
  difficultyLevel: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  maxStudents: number;
  deliveryModes: string[];
}

interface ChapterOption {
  id: string;
  name: string;
  city: string | null;
}

interface OfferingData {
  id: string;
  templateId: string;
  title: string;
  startDate: string;
  endDate: string;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: string;
  locationName: string;
  locationAddress: string;
  zoomLink: string;
  introVideoTitle: string;
  introVideoDescription: string;
  introVideoProvider: string;
  introVideoUrl: string;
  introVideoThumbnail: string;
  capacity: number;
  send24HrReminder: boolean;
  send1HrReminder: boolean;
  status: string;
  chapterId: string;
  semester: string;
  enrolledCount: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const difficultyLabels: Record<string, string> = {
  LEVEL_101: "101",
  LEVEL_201: "201",
  LEVEL_301: "301",
  LEVEL_401: "401",
};

export function ClassSettingsClient({
  templates,
  chapters,
  selectedTemplateId,
  offering,
}: {
  templates: TemplateOption[];
  chapters: ChapterOption[];
  selectedTemplateId: string | null;
  offering: OfferingData | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [templateId, setTemplateId] = useState(offering?.templateId || selectedTemplateId || "");
  const [meetingDays, setMeetingDays] = useState<string[]>(offering?.meetingDays || []);
  const [deliveryMode, setDeliveryMode] = useState(offering?.deliveryMode || "VIRTUAL");
  const [introVideoProvider, setIntroVideoProvider] = useState(offering?.introVideoProvider || "YOUTUBE");

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function toggleDay(day: string) {
    setMeetingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      formData.set("meetingDays", meetingDays.join(","));
      formData.set("deliveryMode", deliveryMode);
      formData.set("introVideoProvider", introVideoProvider);

      if (offering) {
        formData.set("id", offering.id);
        await updateClassOffering(formData);
        setSuccess("Class offering updated successfully!");
      } else {
        formData.set("templateId", templateId);
        const result = await createClassOffering(formData);
        setSuccess("Class offering created! Sessions have been auto-generated.");
        router.push(`/curriculum/${result.id}`);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!offering) return;
    if (!confirm("Publish this class? Students will be able to see and enroll.")) return;
    setLoading(true);
    setError("");

    try {
      await publishClassOffering(offering.id);
      setSuccess("Class published and open for enrollment!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Template Selection */}
        {!offering && (
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Curriculum Template *</label>
            <select
              className="form-input"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              <option value="">Select a curriculum...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({difficultyLabels[t.difficultyLevel]} - {t.interestArea}) - {t.durationWeeks} weeks
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                {selectedTemplate.durationWeeks} weeks, {selectedTemplate.sessionsPerWeek}x/week,
                up to {selectedTemplate.maxStudents} students
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Class Title *</label>
          <input
            name="title"
            className="form-input"
            required
            defaultValue={offering?.title || selectedTemplate?.title || ""}
            placeholder="e.g., Watercolor Foundations - Spring 2025"
          />
        </div>

        {/* Start Date */}
        <div className="form-group">
          <label className="form-label">Start Date *</label>
          <input
            name="startDate"
            type="date"
            className="form-input"
            required
            defaultValue={offering?.startDate || ""}
          />
        </div>

        {/* End Date */}
        <div className="form-group">
          <label className="form-label">End Date *</label>
          <input
            name="endDate"
            type="date"
            className="form-input"
            required
            defaultValue={offering?.endDate || ""}
          />
        </div>

        {/* Meeting Days */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Meeting Days *</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  ...(meetingDays.includes(day)
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "var(--surface)" }),
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting Time */}
        <div className="form-group">
          <label className="form-label">Meeting Time *</label>
          <input
            name="meetingTime"
            className="form-input"
            required
            defaultValue={offering?.meetingTime || "16:00-18:00"}
            placeholder="16:00-18:00"
          />
        </div>

        {/* Semester */}
        <div className="form-group">
          <label className="form-label">Semester</label>
          <input
            name="semester"
            className="form-input"
            defaultValue={offering?.semester || ""}
            placeholder="e.g., Spring 2025"
          />
        </div>

        {/* Delivery Mode */}
        <div className="form-group">
          <label className="form-label">Delivery Mode *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["IN_PERSON", "VIRTUAL", "HYBRID"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDeliveryMode(mode)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  ...(deliveryMode === mode
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "var(--surface)" }),
                }}
              >
                {mode.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Capacity */}
        <div className="form-group">
          <label className="form-label">Class Capacity *</label>
          <input
            name="capacity"
            type="number"
            className="form-input"
            required
            min={1}
            defaultValue={offering?.capacity || selectedTemplate?.maxStudents || 25}
          />
        </div>

        {/* Location (for in-person/hybrid) */}
        {(deliveryMode === "IN_PERSON" || deliveryMode === "HYBRID") && (
          <>
            <div className="form-group">
              <label className="form-label">Location Name</label>
              <input
                name="locationName"
                className="form-input"
                defaultValue={offering?.locationName || ""}
                placeholder="e.g., Community Center Room 204"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location Address</label>
              <input
                name="locationAddress"
                className="form-input"
                defaultValue={offering?.locationAddress || ""}
                placeholder="123 Main St, City, State"
              />
            </div>
          </>
        )}

        {/* Zoom Link (for virtual/hybrid) */}
        {(deliveryMode === "VIRTUAL" || deliveryMode === "HYBRID") && (
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Zoom / Meeting Link</label>
            <input
              name="zoomLink"
              className="form-input"
              defaultValue={offering?.zoomLink || ""}
              placeholder="https://zoom.us/j/..."
            />
          </div>
        )}

        {/* Instructor Intro Video */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Instructor Intro Video (recommended)</label>
          <p style={{ margin: "6px 0 10px", fontSize: 13, color: "var(--text-secondary)" }}>
            Add a short video introducing yourself and what students will create in this class.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              name="introVideoTitle"
              className="form-input"
              defaultValue={offering?.introVideoTitle || ""}
              placeholder="Video title (e.g., Welcome to Creative Coding 101)"
            />
            <input
              name="introVideoThumbnail"
              className="form-input"
              defaultValue={offering?.introVideoThumbnail || ""}
              placeholder="Thumbnail URL (optional)"
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["YOUTUBE", "VIMEO", "LOOM", "CUSTOM"].map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setIntroVideoProvider(provider)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  ...(introVideoProvider === provider
                    ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" }
                    : { background: "var(--surface)" }),
                }}
              >
                {provider}
              </button>
            ))}
          </div>

          <input
            name="introVideoUrl"
            className="form-input"
            defaultValue={offering?.introVideoUrl || ""}
            placeholder={
              introVideoProvider === "YOUTUBE"
                ? "https://youtube.com/watch?v=..."
                : introVideoProvider === "VIMEO"
                  ? "https://vimeo.com/..."
                  : introVideoProvider === "LOOM"
                    ? "https://loom.com/share/..."
                    : "https://your-video-url..."
            }
            style={{ marginTop: 10 }}
          />

          <textarea
            name="introVideoDescription"
            className="form-input"
            defaultValue={offering?.introVideoDescription || ""}
            placeholder="One short paragraph: what students will learn, why this class is exciting, and what first session looks like."
            rows={3}
            style={{ marginTop: 10 }}
          />
        </div>

        {/* Chapter */}
        <div className="form-group">
          <label className="form-label">Chapter (optional)</label>
          <select name="chapterId" className="form-input" defaultValue={offering?.chapterId || ""}>
            <option value="">No specific chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}{ch.city ? ` (${ch.city})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Reminder Settings */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Reminder Settings</label>
          <div style={{ display: "flex", gap: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="send24HrReminder"
                value="true"
                defaultChecked={offering?.send24HrReminder !== false}
              />
              Send 24-hour reminder
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="send1HrReminder"
                value="true"
                defaultChecked={offering?.send1HrReminder !== false}
              />
              Send 1-hour reminder
            </label>
          </div>
        </div>

        {/* Status (only for existing offerings) */}
        {offering && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" className="form-input" defaultValue={offering.status}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Saving..." : offering ? "Update Offering" : "Create Offering"}
        </button>
        {offering && offering.status === "DRAFT" && (
          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={handlePublish}
          >
            Publish & Open Enrollment
          </button>
        )}
        {offering && (
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {offering.enrolledCount} student{offering.enrolledCount !== 1 ? "s" : ""} enrolled
          </span>
        )}
      </div>
    </form>
  );
}
