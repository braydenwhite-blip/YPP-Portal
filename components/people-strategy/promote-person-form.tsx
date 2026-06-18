"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { previewPromotion, applyPromotion } from "@/lib/org/promotion-actions";
import type { PromotionPreview } from "@/lib/org/promotion";

/**
 * Promote-from-profile form (Phase 8 surface). Two steps: PREVIEW the access
 * added/removed + setup still needed, then CONFIRM to apply non-destructively.
 * Admin/officer-gated by the caller; the server actions re-check authority.
 */
export function PromotePersonForm({
  userId,
  canonicalTitles,
  chapters,
  mentors,
  committees,
}: {
  userId: string;
  canonicalTitles: string[];
  chapters: Array<{ id: string; name: string }>;
  mentors: Array<{ id: string; name: string }>;
  committees: string[];
}) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [newChapterId, setNewChapterId] = useState("");
  const [assignMentorId, setAssignMentorId] = useState("");
  const [addCommittees, setAddCommittees] = useState<string[]>([]);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const input = () => ({
    userId,
    newTitle,
    effectiveDate,
    reason: reason || null,
    newChapterId: newChapterId || undefined,
    assignMentorId: assignMentorId || undefined,
    addCommittees,
  });

  async function onPreview() {
    setError(null);
    setBusy(true);
    try {
      setPreview(await previewPromotion(input()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the preview.");
    } finally {
      setBusy(false);
    }
  }

  async function onApply() {
    setError(null);
    setBusy(true);
    try {
      await applyPromotion(input());
      setDone(true);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply the promotion.");
    } finally {
      setBusy(false);
    }
  }

  function toggleCommittee(name: string) {
    setAddCommittees((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
    setPreview(null);
  }

  const fieldStyle = { display: "block", width: "100%", marginTop: 4 } as const;

  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Promote / change role</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
        Preview the access added and removed before saving. Nothing is deleted — the
        change is recorded in promotion history.
      </p>

      {done ? (
        <p style={{ fontSize: 14, color: "var(--ps-accent, #2563eb)" }}>
          Promotion applied. Refreshing the profile…
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          New title
          <select
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value);
              setPreview(null);
            }}
            style={fieldStyle}
            required
          >
            <option value="" disabled>
              Select a title…
            </option>
            {canonicalTitles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Effective date
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            style={fieldStyle}
          />
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          New chapter (optional)
          <select
            value={newChapterId}
            onChange={(e) => {
              setNewChapterId(e.target.value);
              setPreview(null);
            }}
            style={fieldStyle}
          >
            <option value="">Unchanged</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Assign mentor (optional)
          <select
            value={assignMentorId}
            onChange={(e) => {
              setAssignMentorId(e.target.value);
              setPreview(null);
            }}
            style={fieldStyle}
          >
            <option value="">No change</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        {committees.length > 0 ? (
          <fieldset style={{ border: "1px solid var(--ps-border, #e5e7eb)", borderRadius: 6, padding: 10 }}>
            <legend style={{ fontSize: 13, fontWeight: 600 }}>Add committees</legend>
            {committees.map((name) => (
              <label key={name} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={addCommittees.includes(name)}
                  onChange={() => toggleCommittee(name)}
                />
                {name}
              </label>
            ))}
          </fieldset>
        ) : null}

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle} />
        </label>

        {error ? <p style={{ color: "var(--danger, #dc2626)", fontSize: 13 }}>{error}</p> : null}

        {preview ? (
          <div className="card" style={{ padding: "12px 14px", background: "var(--ps-accent-soft, #f1f5ff)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              {preview.titleFrom ?? "—"} → {preview.titleTo ?? "—"} · {preview.direction}
              {preview.levelFrom !== preview.levelTo
                ? ` (level ${preview.levelFrom ?? "?"} → ${preview.levelTo ?? "?"})`
                : ""}
            </div>
            {preview.accessAdded.length > 0 ? (
              <PreviewList title="Access added" items={preview.accessAdded} />
            ) : null}
            {preview.accessRemoved.length > 0 ? (
              <PreviewList title="Access removed" items={preview.accessRemoved} />
            ) : null}
            {preview.committeesAdded.length > 0 ? (
              <PreviewList title="Committees added" items={preview.committeesAdded} />
            ) : null}
            {preview.setupItems.length > 0 ? (
              <PreviewList
                title="Setup still needed"
                items={preview.setupItems.map((s) => s.label)}
              />
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={onPreview}
            disabled={busy || !newTitle}
          >
            {busy ? "Working…" : "Preview changes"}
          </button>
          {preview ? (
            <button type="button" className="btn" onClick={onApply} disabled={busy}>
              Confirm &amp; apply
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{title}</div>
      <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 13 }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
