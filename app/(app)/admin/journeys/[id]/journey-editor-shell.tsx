"use client";

import { useState, useTransition } from "react";

import { createDraftFromPublished, updateJourneyMeta } from "@/lib/journey-editor/actions";

type Tab = "overview" | "beats" | "gates" | "assignments" | "versions";

export interface JourneyEditorShellProps {
  canPublish: boolean;
  journey: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
  };
  versions: Array<{
    id: string;
    versionNumber: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    beatCount: number;
    gateCount: number;
    updatedAt: string;
  }>;
  assignments: Array<{ audience: string; autoEnroll: boolean }>;
  auditLog: Array<{
    id: string;
    action: string;
    actorId: string | null;
    createdAt: string;
  }>;
}

export function JourneyEditorShell(props: JourneyEditorShellProps) {
  const [tab, setTab] = useState<Tab>("overview");

  const draftVersion = props.versions.find((v) => v.status === "DRAFT");
  const publishedVersion = props.versions.find((v) => v.status === "PUBLISHED");

  return (
    <section className="admin-tabs">
      <nav className="admin-tab-nav" role="tablist" aria-label="Journey editor tabs">
        <TabButton current={tab} setTab={setTab} value="overview">Overview</TabButton>
        <TabButton current={tab} setTab={setTab} value="beats">
          Beats {draftVersion ? `(${draftVersion.beatCount})` : ""}
        </TabButton>
        <TabButton current={tab} setTab={setTab} value="gates">
          Gates {draftVersion ? `(${draftVersion.gateCount})` : ""}
        </TabButton>
        <TabButton current={tab} setTab={setTab} value="assignments">
          Assignments ({props.assignments.length})
        </TabButton>
        <TabButton current={tab} setTab={setTab} value="versions">
          Versions ({props.versions.length})
        </TabButton>
      </nav>

      <div className="admin-tab-panel">
        {tab === "overview" ? (
          <OverviewTab
            journey={props.journey}
            canPublish={props.canPublish}
            draftVersion={draftVersion}
            publishedVersion={publishedVersion}
          />
        ) : null}
        {tab === "beats" ? <PlaceholderPanel label="Beats editor — Commit 7." /> : null}
        {tab === "gates" ? <PlaceholderPanel label="Gate builder — Commit 9." /> : null}
        {tab === "assignments" ? (
          <PlaceholderPanel label="Audience assignment editor — Commit 13." />
        ) : null}
        {tab === "versions" ? (
          <VersionsTab versions={props.versions} auditLog={props.auditLog} />
        ) : null}
      </div>
    </section>
  );
}

function TabButton(props: {
  current: Tab;
  setTab: (t: Tab) => void;
  value: Tab;
  children: React.ReactNode;
}) {
  const isActive = props.current === props.value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={`admin-tab ${isActive ? "is-active" : ""}`}
      onClick={() => props.setTab(props.value)}
    >
      {props.children}
    </button>
  );
}

function OverviewTab(props: {
  journey: { id: string; slug: string; title: string; description: string | null };
  canPublish: boolean;
  draftVersion?: JourneyEditorShellProps["versions"][number];
  publishedVersion?: JourneyEditorShellProps["versions"][number];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftPending, startDraftTransition] = useTransition();
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    setError(null);
    startTransition(async () => {
      try {
        await updateJourneyMeta({ journeyId: props.journey.id, slug, title, description });
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function handleCreateDraft() {
    setDraftMessage(null);
    startDraftTransition(async () => {
      try {
        const result = await createDraftFromPublished({ journeyId: props.journey.id });
        setDraftMessage(`Draft v${result.versionNumber} ready.`);
      } catch (e) {
        setDraftMessage(e instanceof Error ? e.message : "Failed to create draft.");
      }
    });
  }

  return (
    <div className="grid-2col">
      <form action={(fd) => handleSubmit(fd)} className="card admin-form">
        <h2>Journey details</h2>
        <fieldset disabled={!props.canPublish}>
          <label className="form-row">
            <span>Title</span>
            <input
              name="title"
              required
              minLength={3}
              defaultValue={props.journey.title}
            />
          </label>
          <label className="form-row">
            <span>Slug</span>
            <input
              name="slug"
              required
              pattern="[a-z0-9][a-z0-9\-]*"
              defaultValue={props.journey.slug}
            />
          </label>
          <label className="form-row">
            <span>Description</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={props.journey.description ?? ""}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {savedAt ? <p className="form-success">Saved.</p> : null}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </fieldset>
      </form>

      <aside className="card">
        <h2>Status</h2>
        <dl className="key-value-list">
          <dt>Published</dt>
          <dd>
            {props.publishedVersion
              ? `v${props.publishedVersion.versionNumber} (${props.publishedVersion.beatCount} beats)`
              : "—"}
          </dd>
          <dt>Draft</dt>
          <dd>
            {props.draftVersion
              ? `v${props.draftVersion.versionNumber} (${props.draftVersion.beatCount} beats)`
              : "—"}
          </dd>
        </dl>
        {props.canPublish && !props.draftVersion ? (
          <button
            className="btn"
            onClick={handleCreateDraft}
            disabled={draftPending}
          >
            {draftPending ? "Creating draft…" : "Start a new draft"}
          </button>
        ) : null}
        {draftMessage ? <p className="muted">{draftMessage}</p> : null}
      </aside>
    </div>
  );
}

function VersionsTab(props: {
  versions: JourneyEditorShellProps["versions"];
  auditLog: JourneyEditorShellProps["auditLog"];
}) {
  return (
    <div className="grid-2col">
      <div className="card">
        <h2>Versions</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Beats</th>
              <th>Gates</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {props.versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.versionNumber}</td>
                <td>{v.status}</td>
                <td>{v.beatCount}</td>
                <td>{v.gateCount}</td>
                <td>{new Date(v.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Recent activity</h2>
        {props.auditLog.length === 0 ? (
          <p className="muted">No edits yet.</p>
        ) : (
          <ul className="activity-list">
            {props.auditLog.map((a) => (
              <li key={a.id}>
                <strong>{a.action}</strong>{" "}
                <span className="muted">
                  by {a.actorId ?? "unknown"} · {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="card">
      <p className="muted">{label}</p>
    </div>
  );
}
