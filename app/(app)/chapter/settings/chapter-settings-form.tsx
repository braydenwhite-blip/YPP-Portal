"use client";

import { useState } from "react";
import { updateChapterProfile, uploadChapterImage } from "@/lib/chapter-settings-actions";

type Settings = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  region: string | null;
  description: string | null;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isPublic: boolean;
  joinPolicy: string;
};

export function ChapterSettingsForm({ settings }: { settings: Settings }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await updateChapterProfile(formData);
      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(imageType: "logo" | "banner", file: File) {
    setUploading(imageType);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("imageType", imageType);
      await uploadChapterImage(formData);
      setMessage({ type: "success", text: `${imageType === "logo" ? "Logo" : "Banner"} uploaded` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="card">
      <h3>Chapter Profile</h3>

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 14,
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="form-label">Chapter Slug</label>
          <input
            type="text"
            name="slug"
            defaultValue={settings.slug ?? ""}
            placeholder="houston-chapter"
            className="input"
            pattern="[a-z0-9-]+"
            title="Lowercase letters, numbers, and hyphens only"
          />
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Used in your chapter&apos;s public URL: /chapters/{settings.slug ?? "your-slug"}
          </p>
        </div>

        <div>
          <label className="form-label">Tagline</label>
          <input
            type="text"
            name="tagline"
            defaultValue={settings.tagline ?? ""}
            placeholder="Empowering the next generation of leaders"
            className="input"
            maxLength={100}
          />
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea
            name="description"
            defaultValue={settings.description ?? ""}
            placeholder="Tell prospective members what makes your chapter special..."
            className="input"
            rows={4}
            maxLength={1000}
          />
        </div>

        <div>
          <label className="form-label">Join Policy</label>
          <select name="joinPolicy" defaultValue={settings.joinPolicy} className="input">
            <option value="OPEN">Open — Anyone can join immediately</option>
            <option value="APPROVAL">Approval — Chapter lead reviews requests</option>
            <option value="INVITE_ONLY">Invite Only — Members must be invited</option>
          </select>
        </div>

        <div>
          <label className="form-label">
            <input
              type="checkbox"
              name="isPublic"
              value="true"
              defaultChecked={settings.isPublic}
              style={{ marginRight: 8 }}
            />
            Show in public chapter directory
          </label>
        </div>

        <button type="submit" className="button" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <hr style={{ margin: "24px 0", borderColor: "var(--border)" }} />

      <h3>Chapter Images</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
        <div>
          <label className="form-label">Logo (max 2MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload("logo", file);
            }}
            disabled={uploading === "logo"}
          />
          {uploading === "logo" && <p style={{ fontSize: 13, color: "var(--muted)" }}>Uploading...</p>}
        </div>

        <div>
          <label className="form-label">Banner (max 5MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload("banner", file);
            }}
            disabled={uploading === "banner"}
          />
          {uploading === "banner" && <p style={{ fontSize: 13, color: "var(--muted)" }}>Uploading...</p>}
        </div>
      </div>
    </div>
  );
}
