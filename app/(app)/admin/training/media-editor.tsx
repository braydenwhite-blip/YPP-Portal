"use client";

import {
  createTrainingVideo,
  deleteTrainingVideo,
  updateTrainingVideo,
} from "@/lib/training-video-actions";
import {
  createTrainingResource,
  deleteTrainingResource,
  updateTrainingResource,
} from "@/lib/resource-actions";

const VIDEO_PROVIDERS = ["YOUTUBE", "VIMEO", "LOOM", "CUSTOM"] as const;
const RESOURCE_TYPES = ["PDF", "DOC", "SHEET", "LINK", "VIDEO"] as const;

export interface ModuleVideo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  videoProvider: string;
  videoDuration: number;
  sortOrder: number;
  isSupplementary: boolean;
}

export interface ModuleResource {
  id: string;
  title: string;
  description: string | null;
  resourceUrl: string;
  resourceType: string;
  sortOrder: number;
}

export function VideoEditor({
  moduleId,
  videos,
}: {
  moduleId: string;
  videos: ModuleVideo[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ marginBottom: 8 }}>Videos ({videos.length})</h4>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
        Add multiple videos per module. Mark as supplementary if optional.
      </p>

      {videos.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          {videos.map((v) => (
            <div
              key={v.id}
              style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
            >
              <form action={updateTrainingVideo} className="form-grid">
                <input type="hidden" name="videoId" value={v.id} />
                <div className="grid two">
                  <label className="form-row">
                    Title
                    <input className="input" name="title" defaultValue={v.title} required />
                  </label>
                  <label className="form-row">
                    Sort order
                    <input
                      className="input"
                      name="sortOrder"
                      type="number"
                      min={1}
                      defaultValue={v.sortOrder}
                      required
                    />
                  </label>
                </div>
                <label className="form-row">
                  Video URL
                  <input
                    className="input"
                    name="videoUrl"
                    type="url"
                    defaultValue={v.videoUrl}
                    required
                  />
                </label>
                <div className="grid two">
                  <label className="form-row">
                    Provider
                    <select
                      className="input"
                      name="videoProvider"
                      defaultValue={v.videoProvider}
                      required
                    >
                      {VIDEO_PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-row">
                    Duration (seconds)
                    <input
                      className="input"
                      name="videoDuration"
                      type="number"
                      min={0}
                      defaultValue={v.videoDuration}
                    />
                  </label>
                </div>
                <label className="form-row">
                  Description (optional)
                  <textarea
                    className="input"
                    name="description"
                    rows={2}
                    defaultValue={v.description ?? ""}
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="isSupplementary"
                    defaultChecked={v.isSupplementary}
                  />
                  Supplementary (optional viewing)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button small" type="submit">
                    Save video
                  </button>
                </div>
              </form>
              <form
                action={deleteTrainingVideo}
                onSubmit={(e) => {
                  if (!confirm(`Delete video "${v.title}"?`)) e.preventDefault();
                }}
                style={{ marginTop: 8 }}
              >
                <input type="hidden" name="videoId" value={v.id} />
                <button className="button small outline" type="submit">
                  Delete video
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form
        action={createTrainingVideo}
        className="form-grid"
        style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
      >
        <input type="hidden" name="moduleId" value={moduleId} />
        <div className="grid two">
          <label className="form-row">
            New video title
            <input className="input" name="title" required placeholder="Module Walkthrough" />
          </label>
          <label className="form-row">
            Sort order
            <input
              className="input"
              name="sortOrder"
              type="number"
              min={1}
              defaultValue={videos.length + 1}
              required
            />
          </label>
        </div>
        <label className="form-row">
          Video URL
          <input
            className="input"
            name="videoUrl"
            type="url"
            required
            placeholder="https://youtube.com/watch?v=..."
          />
        </label>
        <div className="grid two">
          <label className="form-row">
            Provider
            <select className="input" name="videoProvider" defaultValue="YOUTUBE" required>
              {VIDEO_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            Duration (seconds)
            <input className="input" name="videoDuration" type="number" min={0} defaultValue={0} />
          </label>
        </div>
        <label className="form-row">
          Description (optional)
          <textarea className="input" name="description" rows={2} />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <input type="checkbox" name="isSupplementary" />
          Supplementary (optional viewing)
        </label>
        <button className="button small" type="submit">
          Add video
        </button>
      </form>
    </div>
  );
}

export function ResourceEditor({
  moduleId,
  resources,
}: {
  moduleId: string;
  resources: ModuleResource[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ marginBottom: 8 }}>Resources ({resources.length})</h4>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
        Slides, PDFs, links, and supporting materials for learners.
      </p>

      {resources.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          {resources.map((r) => (
            <div
              key={r.id}
              style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
            >
              <form action={updateTrainingResource} className="form-grid">
                <input type="hidden" name="resourceId" value={r.id} />
                <div className="grid three">
                  <label className="form-row">
                    Title
                    <input className="input" name="title" defaultValue={r.title} required />
                  </label>
                  <label className="form-row">
                    Type
                    <select
                      className="input"
                      name="resourceType"
                      defaultValue={r.resourceType}
                      required
                    >
                      {RESOURCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-row">
                    Sort order
                    <input
                      className="input"
                      name="sortOrder"
                      type="number"
                      min={1}
                      defaultValue={r.sortOrder}
                      required
                    />
                  </label>
                </div>
                <label className="form-row">
                  URL
                  <input
                    className="input"
                    name="resourceUrl"
                    type="url"
                    defaultValue={r.resourceUrl}
                    required
                  />
                </label>
                <label className="form-row">
                  Description (optional)
                  <textarea
                    className="input"
                    name="description"
                    rows={2}
                    defaultValue={r.description ?? ""}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button small" type="submit">
                    Save resource
                  </button>
                </div>
              </form>
              <form
                action={deleteTrainingResource}
                onSubmit={(e) => {
                  if (!confirm(`Delete resource "${r.title}"?`)) e.preventDefault();
                }}
                style={{ marginTop: 8 }}
              >
                <input type="hidden" name="resourceId" value={r.id} />
                <button className="button small outline" type="submit">
                  Delete resource
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form
        action={createTrainingResource}
        className="form-grid"
        style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
      >
        <input type="hidden" name="moduleId" value={moduleId} />
        <div className="grid three">
          <label className="form-row">
            New resource title
            <input className="input" name="title" required placeholder="Workshop slides" />
          </label>
          <label className="form-row">
            Type
            <select className="input" name="resourceType" defaultValue="LINK" required>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            Sort order
            <input
              className="input"
              name="sortOrder"
              type="number"
              min={1}
              defaultValue={resources.length + 1}
              required
            />
          </label>
        </div>
        <label className="form-row">
          URL
          <input
            className="input"
            name="resourceUrl"
            type="url"
            required
            placeholder="https://docs.google.com/..."
          />
        </label>
        <label className="form-row">
          Description (optional)
          <textarea className="input" name="description" rows={2} />
        </label>
        <button className="button small" type="submit">
          Add resource
        </button>
      </form>
    </div>
  );
}
