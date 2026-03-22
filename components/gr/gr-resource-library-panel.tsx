"use client";

import { useTransition, useState } from "react";
import { createGRResource, updateGRResource, deleteGRResource } from "@/lib/gr-actions";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  isUpload: boolean;
  tags: string[];
  createdAt: string;
}

export default function GRResourceLibraryPanel({ resources }: { resources: Resource[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? resources.filter(
        (r) =>
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : resources;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createGRResource(formData);
        setSuccess("Resource created.");
        setShowCreate(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function handleDelete(resourceId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("resourceId", resourceId);
    startTransition(async () => {
      try {
        await deleteGRResource(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <button className="button primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Add Resource"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "0.75rem" }}>{error}</p>}
      {success && <p style={{ color: "var(--success)", marginBottom: "0.75rem" }}>{success}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Add Resource</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Title
              <input name="title" className="input" required />
            </label>
            <label>
              URL
              <input name="url" className="input" required placeholder="https://..." />
            </label>
            <label>
              Description (optional)
              <textarea name="description" className="input" rows={2} />
            </label>
            <label>
              Tags (comma-separated)
              <input name="tags" className="input" placeholder="onboarding, training, guide" />
            </label>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Adding..." : "Add Resource"}
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          No resources found.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {filtered.map((r) => (
            <div key={r.id} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{r.title}</strong>
                  {r.isUpload && <span className="badge" style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>Upload</span>}
                  <br />
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.85rem", color: "var(--link)" }}>
                    {r.url}
                  </a>
                  {r.description && <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>{r.description}</p>}
                  {r.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {r.tags.map((tag) => (
                        <span key={tag} className="badge" style={{ fontSize: "0.7rem" }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="button ghost"
                  style={{ color: "var(--danger)", fontSize: "0.8rem" }}
                  disabled={isPending}
                  onClick={() => handleDelete(r.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
