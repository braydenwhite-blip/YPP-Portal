"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { InstructorOpsRecord, InstructorOpsStage } from "@/lib/instructor-ops";
import { completenessTone } from "@/lib/instructor-completeness";
import type { InstructorLifecycleStage } from "@prisma/client";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
import { IdentityCell, Meter } from "@/components/people-strategy/people-suite";
import { SuiteToast, makeToast, type ToastState } from "@/components/people-strategy/suite-toast";
import {
  updateInstructorLifecycleStage,
  addTagToInstructor,
  createInstructorNote,
  bulkUpdateLifecycleStage,
  bulkAddTag,
  bulkSetOnHold,
  createSavedView,
  deleteSavedView,
} from "@/lib/instructor-ops-actions";

// ── Types ────────────────────────────────────────────────────────────────────

type Tag = {
  id: string;
  namespace: string;
  slug: string;
  label: string;
  color: string | null;
};

type SavedView = {
  id: string;
  name: string;
  filters: unknown;
  isShared: boolean;
  scope: string;
};

type Metrics = {
  total: number;
  attention: number;
  onboarding: number;
  ready: number;
  active: number;
  activeAssignments: number;
};

type SortKey =
  | "name"
  | "chapterName"
  | "stageLabel"
  | "currentLoadLabel"
  | "trainingPercent"
  | "completeness"
  | "flags"
  | "latestActivityAt";

const STAGES: Array<{ value: InstructorOpsStage; label: string }> = [
  { value: "APPLICANTS", label: "Applicants" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "REVIEW", label: "Review" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "READY", label: "Ready" },
  { value: "ACTIVE", label: "Active" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "PAUSED", label: "Paused" },
  { value: "NEEDS_ATTENTION", label: "Needs Attention" },
];

const LIFECYCLE_STAGES: Array<{ value: InstructorLifecycleStage; label: string }> = [
  { value: "APPLICANT", label: "Applicant" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "ACTIVE", label: "Active" },
  { value: "BENCH", label: "Bench" },
  { value: "PAUSED", label: "Paused" },
  { value: "ALUMNI", label: "Alumni" },
];

// ── CSV export ─────────────────────────────────────────────────────────────--

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportCSV(records: InstructorOpsRecord[]) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Chapter",
    "Stage",
    "Load",
    "Training %",
    "Completeness %",
    "Missing fields",
    "Mentor",
    "Active assignments",
    "Flags",
    "Tags",
    "Last activity",
  ];
  const rows = records.map((r) => [
    r.name,
    r.email,
    r.phone ?? "",
    r.chapterName,
    r.stageLabel,
    r.currentLoadLabel,
    String(r.trainingPercent),
    String(r.completeness.score),
    r.completeness.missing.map((m) => m.label).join("; "),
    r.mentorName ?? "",
    String(r.activeAssignmentCount),
    String(r.attentionFlags.length),
    r.tags.join("; "),
    new Date(r.latestActivityAt).toISOString(),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCSV(String(cell ?? ""))).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "instructors.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────--

export default function InstructorDatabaseClient({
  records: initialRecords,
  chapters,
  tags,
  allTags,
  savedViews: initialSavedViews,
  metrics,
}: {
  records: InstructorOpsRecord[];
  chapters: Array<{ id: string; name: string }>;
  tags: string[];
  allTags: Tag[];
  savedViews: SavedView[];
  metrics: Metrics;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [tag, setTag] = useState("");
  const [load, setLoad] = useState("");
  const [availability, setAvailability] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [mentorEligible, setMentorEligible] = useState(false);
  const [workshopEligible, setWorkshopEligible] = useState(false);
  const [leadershipTrack, setLeadershipTrack] = useState(false);
  const [missingInfo, setMissingInfo] = useState(false);
  const [completenessMax, setCompletenessMax] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Selection + bulk
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkStage, setBulkStage] = useState<InstructorLifecycleStage>("ACTIVE");
  const [bulkTagId, setBulkTagId] = useState("");

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialSavedViews);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  // Open quick-action row
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Transient action confirmations
  const [toast, setToast] = useState<ToastState>(null);

  function resetFilters() {
    setSearch("");
    setStage("");
    setChapterId("");
    setTag("");
    setLoad("");
    setAvailability("");
    setNeedsAttention(false);
    setMentorEligible(false);
    setWorkshopEligible(false);
    setLeadershipTrack(false);
    setMissingInfo(false);
    setCompletenessMax("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = records.filter((record) => {
      if (stage && record.stage !== stage) return false;
      if (chapterId && record.chapterId !== chapterId) return false;
      if (tag && !record.tags.includes(tag)) return false;
      if (load && record.currentLoadLabel.toLowerCase() !== load.toLowerCase()) return false;
      if (availability && !record.availabilityTags.includes(availability)) return false;
      if (needsAttention && !record.needsAttention) return false;
      if (mentorEligible && !record.mentorEligible) return false;
      if (workshopEligible && !record.workshopEligible) return false;
      if (leadershipTrack && !record.leadershipTrack) return false;
      if (missingInfo && record.completeness.missing.length === 0) return false;
      if (completenessMax && record.completeness.score >= Number(completenessMax)) return false;
      if (!q) return true;
      return [
        record.name,
        record.email,
        record.chapterName,
        record.stageLabel,
        record.currentLoadLabel,
        record.mentorName ?? "",
        ...record.tags,
        ...record.attentionFlags.map((flag) => `${flag.title} ${flag.detail}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return result.toSorted((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case "trainingPercent":
          av = a.trainingPercent;
          bv = b.trainingPercent;
          break;
        case "completeness":
          av = a.completeness.score;
          bv = b.completeness.score;
          break;
        case "flags":
          av = a.attentionFlags.length;
          bv = b.attentionFlags.length;
          break;
        case "latestActivityAt":
          av = new Date(a.latestActivityAt).getTime();
          bv = new Date(b.latestActivityAt).getTime();
          break;
        default:
          av = String(a[sortKey] ?? "").toLowerCase();
          bv = String(b[sortKey] ?? "").toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [
    records,
    search,
    stage,
    chapterId,
    tag,
    load,
    availability,
    needsAttention,
    mentorEligible,
    workshopEligible,
    leadershipTrack,
    missingInfo,
    completenessMax,
    sortKey,
    sortDir,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "chapterName" ? "asc" : "desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.length === filtered.length ? [] : filtered.map((r) => r.id)
    );
  }

  // ── Quick (single-row) actions ─────────────────────────────────────────────

  const stageLabelOf = (stage: InstructorLifecycleStage) =>
    LIFECYCLE_STAGES.find((s) => s.value === stage)?.label ?? stage;

  function applyStage(userId: string, newStage: InstructorLifecycleStage) {
    const name = records.find((r) => r.id === userId)?.name ?? "Instructor";
    startTransition(() => {
      updateInstructorLifecycleStage(userId, newStage);
    });
    setOpenRowId(null);
    setToast(makeToast(`${name} moved to ${stageLabelOf(newStage)}.`));
  }

  function applyAddTag(userId: string, tagId: string) {
    const t = allTags.find((x) => x.id === tagId);
    if (t) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === userId && !r.tags.includes(t.label)
            ? { ...r, tags: [...r.tags, t.label] }
            : r
        )
      );
    }
    startTransition(() => {
      addTagToInstructor(userId, tagId);
    });
    if (t) setToast(makeToast(`Tagged “${t.label}”.`));
  }

  function applyHold(userId: string, onHold: boolean) {
    startTransition(() => {
      bulkSetOnHold([userId], onHold);
    });
    setOpenRowId(null);
    setToast(makeToast(onHold ? "Instructor put on hold." : "Hold removed."));
  }

  function applyNote(userId: string, body: string) {
    if (!body.trim()) return;
    startTransition(() => {
      createInstructorNote({ userId, body: body.trim() });
    });
    setOpenRowId(null);
    setToast(makeToast("Note added."));
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  function handleBulkApply() {
    if (selectedIds.length === 0 || !bulkAction) return;
    const ids = [...selectedIds];
    const count = ids.length;
    const noun = `${count} instructor${count === 1 ? "" : "s"}`;
    startTransition(async () => {
      try {
        let message = "";
        if (bulkAction === "stage") {
          await bulkUpdateLifecycleStage(ids, bulkStage);
          message = `Moved ${noun} to ${stageLabelOf(bulkStage)}.`;
        } else if (bulkAction === "tag" && bulkTagId) {
          await bulkAddTag(ids, bulkTagId);
          const t = allTags.find((x) => x.id === bulkTagId);
          if (t) {
            setRecords((prev) =>
              prev.map((r) =>
                ids.includes(r.id) && !r.tags.includes(t.label)
                  ? { ...r, tags: [...r.tags, t.label] }
                  : r
              )
            );
          }
          message = `Tagged ${noun}${t ? ` with “${t.label}”` : ""}.`;
        } else if (bulkAction === "hold") {
          await bulkSetOnHold(ids, true);
          message = `Put ${noun} on hold.`;
        } else if (bulkAction === "unhold") {
          await bulkSetOnHold(ids, false);
          message = `Removed hold from ${noun}.`;
        }
        setSelectedIds([]);
        setBulkAction("");
        if (message) setToast(makeToast(message));
      } catch {
        setToast(makeToast("Bulk update failed. Please try again.", "error"));
      }
    });
  }

  // ── Saved views ────────────────────────────────────────────────────────────

  function currentFilters() {
    return {
      search,
      stage,
      chapterId,
      tag,
      load,
      availability,
      needsAttention,
      mentorEligible,
      workshopEligible,
      leadershipTrack,
      missingInfo,
      completenessMax,
    };
  }

  function applyView(view: SavedView) {
    const f = (view.filters ?? {}) as Record<string, unknown>;
    setSearch(typeof f.search === "string" ? f.search : "");
    setStage(typeof f.stage === "string" ? f.stage : "");
    setChapterId(typeof f.chapterId === "string" ? f.chapterId : "");
    setTag(typeof f.tag === "string" ? f.tag : "");
    setLoad(typeof f.load === "string" ? f.load : "");
    setAvailability(typeof f.availability === "string" ? f.availability : "");
    setNeedsAttention(Boolean(f.needsAttention));
    setMentorEligible(Boolean(f.mentorEligible));
    setWorkshopEligible(Boolean(f.workshopEligible));
    setLeadershipTrack(Boolean(f.leadershipTrack));
    setMissingInfo(Boolean(f.missingInfo));
    setCompletenessMax(typeof f.completenessMax === "string" ? f.completenessMax : "");
  }

  async function handleSaveView() {
    if (!newViewName.trim()) return;
    const result = await createSavedView({
      name: newViewName.trim(),
      filters: currentFilters(),
    });
    if (result.success) {
      setSavedViews((prev) => [...prev, result.view as SavedView]);
      setNewViewName("");
      setShowSaveView(false);
    }
  }

  async function handleDeleteView(id: string) {
    await deleteSavedView(id);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="ps-page psuite instructor-ops-page instructor-database-page">
      <ActionCommandBar
        eyebrow="Admin · Instructor Database"
        title="Instructor Database"
        subtitle="One command center for every instructor: search, filter, sort, spot missing information, and take action without leaving the table."
        meta={`${metrics.total} instructors · ${metrics.activeAssignments} active assignments`}
        actions={
          <>
            <Link href="/admin/instructors/hub" className="button secondary">
              Pipeline hub
            </Link>
            <Link href="/admin/instructors/lifecycle" className="button secondary">
              Lifecycle board
            </Link>
            <Link href="/admin/instructors/attention" className="button">
              Attention inbox
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div className="psuite-stat-strip">
        <StatCard label="Total instructors" value={metrics.total} icon="users" tone="accent" />
        <StatCard label="Onboarding" value={metrics.onboarding} icon="clock" />
        <StatCard label="Needs attention" value={metrics.attention} icon="alert" tone={metrics.attention > 0 ? "danger" : "default"} />
        <StatCard label="Ready / available" value={metrics.ready} icon="check" tone="success" />
        <StatCard label="Active assignments" value={metrics.activeAssignments} icon="layers" />
      </div>

      {/* Filters */}
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="instructor-directory-filter-row">
          <input
            className="input"
            placeholder="Search name, email, skill, chapter, or flag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="input" value={load} onChange={(e) => setLoad(e.target.value)}>
            <option value="">Any load</option>
            <option value="Waiting">Waiting</option>
            <option value="Available">Available</option>
            <option value="Active">Active</option>
            <option value="Overloaded">Overloaded</option>
          </select>
          <select className="input" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="">Any availability</option>
            <option value="Weekends">Weekends</option>
            <option value="Evenings">Evenings</option>
            <option value="Weekdays">Weekdays</option>
            <option value="Virtual">Virtual</option>
            <option value="In Person">In Person</option>
          </select>
          <select className="input" value={completenessMax} onChange={(e) => setCompletenessMax(e.target.value)}>
            <option value="">Any completeness</option>
            <option value="50">Below 50%</option>
            <option value="80">Below 80%</option>
            <option value="100">Not 100%</option>
          </select>
        </div>

        <div className="instructor-directory-chip-row">
          <ToggleChip active={missingInfo} onClick={() => setMissingInfo((v) => !v)}>
            Has missing info
          </ToggleChip>
          <ToggleChip active={needsAttention} onClick={() => setNeedsAttention((v) => !v)}>
            Needs attention
          </ToggleChip>
          <ToggleChip active={mentorEligible} onClick={() => setMentorEligible((v) => !v)}>
            Mentor eligible
          </ToggleChip>
          <ToggleChip active={workshopEligible} onClick={() => setWorkshopEligible((v) => !v)}>
            Workshop eligible
          </ToggleChip>
          <ToggleChip active={leadershipTrack} onClick={() => setLeadershipTrack((v) => !v)}>
            Leadership track
          </ToggleChip>
          <button type="button" className="button small secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>

        {/* Saved views */}
        <div className="instructor-directory-chip-row" style={{ marginTop: 8 }}>
          {savedViews.map((v) => (
            <span key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button
                type="button"
                className="instructor-directory-chip"
                onClick={() => applyView(v)}
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteView(v.id)}
                title="Delete saved view"
                style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
              >
                ×
              </button>
            </span>
          ))}
          {showSaveView ? (
            <span style={{ display: "inline-flex", gap: 4 }}>
              <input
                className="input"
                style={{ width: 160 }}
                placeholder="View name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
              />
              <button type="button" className="button small" onClick={handleSaveView}>
                Save
              </button>
              <button
                type="button"
                className="button small secondary"
                onClick={() => setShowSaveView(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="button small secondary"
              onClick={() => setShowSaveView(true)}
            >
              + Save view
            </button>
          )}
          <button
            type="button"
            className="button small outline"
            onClick={() => exportCSV(filtered)}
            style={{ marginLeft: "auto" }}
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Bulk toolbar */}
      {selectedIds.length > 0 && (
        <div className="psuite-bulkbar">
          <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedIds.length} selected</span>
          <select className="input" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option value="">Choose action…</option>
            <option value="stage">Set lifecycle stage</option>
            <option value="tag">Add tag</option>
            <option value="hold">Put on hold</option>
            <option value="unhold">Remove hold</option>
          </select>
          {bulkAction === "stage" && (
            <select
              className="input"
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value as InstructorLifecycleStage)}
            >
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
          {bulkAction === "tag" && (
            <select className="input" value={bulkTagId} onChange={(e) => setBulkTagId(e.target.value)}>
              <option value="">Select tag…</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>{t.namespace.toLowerCase()}: {t.label}</option>
              ))}
            </select>
          )}
          <button type="button" className="button small" onClick={handleBulkApply} disabled={!bulkAction}>
            Apply
          </button>
          <button type="button" className="button small secondary" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      )}

      <div className="instructor-directory-count">
        Showing <strong>{filtered.length}</strong> of <strong>{records.length}</strong>
        {isPending && <span style={{ color: "var(--muted)" }}> · saving…</span>}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="table data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <Th onClick={() => toggleSort("name")}>Name{sortArrow("name")}</Th>
              <Th onClick={() => toggleSort("chapterName")}>Chapter{sortArrow("chapterName")}</Th>
              <Th onClick={() => toggleSort("stageLabel")}>Stage{sortArrow("stageLabel")}</Th>
              <Th onClick={() => toggleSort("currentLoadLabel")}>Load{sortArrow("currentLoadLabel")}</Th>
              <Th onClick={() => toggleSort("trainingPercent")}>Training{sortArrow("trainingPercent")}</Th>
              <Th onClick={() => toggleSort("completeness")}>Completeness{sortArrow("completeness")}</Th>
              <Th onClick={() => toggleSort("flags")}>Flags{sortArrow("flags")}</Th>
              <th>Tags</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  No instructors match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <Row
                  key={record.id}
                  record={record}
                  selected={selectedIds.includes(record.id)}
                  onToggle={() => toggleSelect(record.id)}
                  allTags={allTags}
                  isOpen={openRowId === record.id}
                  onOpen={() => setOpenRowId((id) => (id === record.id ? null : record.id))}
                  onStage={applyStage}
                  onAddTag={applyAddTag}
                  onHold={applyHold}
                  onNote={applyNote}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <SuiteToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────--

// Maps an instructor stage label to a People-Suite stage-chip tone.
function stageToneClass(stageLabel: string, needsAttention: boolean): string {
  if (needsAttention) return "is-danger";
  const s = stageLabel.toLowerCase();
  if (s.includes("attention")) return "is-danger";
  if (s.includes("paused") || s.includes("bench") || s.includes("alumni")) return "is-neutral";
  if (s.includes("active") || s.includes("leadership")) return "is-success";
  if (s.includes("ready")) return "is-success";
  if (s.includes("onboard") || s.includes("interview") || s.includes("review") || s.includes("applicant"))
    return "is-warning";
  return "is-accent";
}

// Tone for the training-progress meter: green when essentially done, amber on
// the way, accent at the start.
function trainingTone(pct: number): "success" | "warning" | "accent" {
  if (pct >= 90) return "success";
  if (pct >= 40) return "warning";
  return "accent";
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th onClick={onClick} style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`instructor-directory-chip${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function CompletenessChip({ record }: { record: InstructorOpsRecord }) {
  const tone = completenessTone(record.completeness.score);
  const meterTone = tone === "success" ? "success" : tone === "warning" ? "warning" : "danger";
  const missing = record.completeness.missing;
  return (
    <span
      title={
        missing.length > 0
          ? `Missing: ${missing.map((m) => m.label).join(", ")}`
          : "Complete profile"
      }
      style={{ display: "inline-block" }}
    >
      <Meter
        value={record.completeness.score}
        max={100}
        tone={meterTone}
        width={120}
        label={
          <>
            <strong style={{ color: "var(--ps-ink)" }}>{record.completeness.score}%</strong>
            {missing.length > 0 ? ` · ${missing.length} missing` : " · complete"}
          </>
        }
      />
    </span>
  );
}

function Row({
  record,
  selected,
  onToggle,
  allTags,
  isOpen,
  onOpen,
  onStage,
  onAddTag,
  onHold,
  onNote,
}: {
  record: InstructorOpsRecord;
  selected: boolean;
  onToggle: () => void;
  allTags: Tag[];
  isOpen: boolean;
  onOpen: () => void;
  onStage: (userId: string, stage: InstructorLifecycleStage) => void;
  onAddTag: (userId: string, tagId: string) => void;
  onHold: (userId: string, onHold: boolean) => void;
  onNote: (userId: string, body: string) => void;
}) {
  const [noteBody, setNoteBody] = useState("");
  const [tagPick, setTagPick] = useState("");
  const [stagePick, setStagePick] = useState<InstructorLifecycleStage | "">("");

  return (
    <tr className={selected ? "is-selected" : undefined}>
      <td>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td>
        <IdentityCell name={record.name} sub={record.email} href={record.profileHref} />
      </td>
      <td style={{ fontSize: 12 }}>{record.chapterName}</td>
      <td>
        <span className={`psuite-stage ${stageToneClass(record.stageLabel, record.needsAttention)}`}>
          {record.stageLabel}
        </span>
      </td>
      <td>
        <span className="pill pill-small">{record.currentLoadLabel}</span>
      </td>
      <td>
        <Meter
          value={record.trainingPercent}
          max={100}
          tone={trainingTone(record.trainingPercent)}
          width={110}
          label={<><strong style={{ color: "var(--ps-ink)" }}>{record.trainingPercent}%</strong> trained</>}
        />
      </td>
      <td>
        <CompletenessChip record={record} />
      </td>
      <td style={{ fontSize: 12, textAlign: "center" }}>
        {record.attentionFlags.length > 0 ? (
          <span style={{ color: "#dc2626", fontWeight: 600 }}>{record.attentionFlags.length}</span>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {record.tags.slice(0, 5).map((t) => (
            <span key={t} className="pill pill-small">{t}</span>
          ))}
          {record.tags.length > 5 && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>+{record.tags.length - 5}</span>
          )}
        </div>
      </td>
      <td style={{ position: "relative" }}>
        <button type="button" className="button small secondary" onClick={onOpen}>
          Actions
        </button>
        {isOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              zIndex: 50,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,.14)",
              padding: 12,
              width: 240,
              textAlign: "left",
            }}
          >
            <Link href={record.profileHref} className="button small" style={{ marginBottom: 8 }}>
              Open profile
            </Link>

            <label style={{ fontSize: 11, color: "var(--muted)" }}>Set lifecycle stage</label>
            <select
              className="input"
              value={stagePick}
              onChange={(e) => {
                const v = e.target.value as InstructorLifecycleStage | "";
                setStagePick(v);
                if (v) onStage(record.id, v);
              }}
              style={{ marginBottom: 8 }}
            >
              <option value="">Choose…</option>
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <label style={{ fontSize: 11, color: "var(--muted)" }}>Add tag</label>
            <select
              className="input"
              value={tagPick}
              onChange={(e) => {
                const v = e.target.value;
                setTagPick("");
                if (v) onAddTag(record.id, v);
              }}
              style={{ marginBottom: 8 }}
            >
              <option value="">Choose…</option>
              {allTags
                .filter((t) => !record.tags.includes(t.label))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.namespace.toLowerCase()}: {t.label}</option>
                ))}
            </select>

            <label style={{ fontSize: 11, color: "var(--muted)" }}>Quick note</label>
            <textarea
              className="input"
              rows={2}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add an admin note…"
              style={{ marginBottom: 6 }}
            />
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  onNote(record.id, noteBody);
                  setNoteBody("");
                }}
                disabled={!noteBody.trim()}
              >
                Save note
              </button>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="button small secondary" onClick={() => onHold(record.id, true)}>
                Put on hold
              </button>
              <button type="button" className="button small secondary" onClick={() => onHold(record.id, false)}>
                Remove hold
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
