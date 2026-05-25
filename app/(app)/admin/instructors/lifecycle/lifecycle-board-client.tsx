"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import type { InstructorOpsRow } from "@/lib/instructor-ops-actions";
import {
  updateInstructorLifecycleStage,
  bulkUpdateLifecycleStage,
  bulkAddTag,
  bulkSetOnHold,
  createSavedView,
  deleteSavedView,
  addTagToInstructor,
  removeTagFromInstructor,
  ensureTag,
} from "@/lib/instructor-ops-actions";
import type { InstructorLifecycleStage } from "@prisma/client";
import { KanbanBoard, type KanbanColumnDef } from "@/components/kanban";

// ── Types ──────────────────────────────────────────────────────────────────

type Chapter = { id: string; name: string };
type Mentor = { id: string; name: string };
type Tag = { id: string; namespace: string; slug: string; label: string; color: string | null };
type SavedView = {
  id: string;
  name: string;
  filters: unknown;
  isShared: boolean;
  scope: string;
};

interface Props {
  instructors: InstructorOpsRow[];
  chapters: Chapter[];
  mentors: Mentor[];
  allTags: Tag[];
  savedViews: SavedView[];
}

// ── Lifecycle stage columns ─────────────────────────────────────────────────

const LIFECYCLE_COLUMNS: KanbanColumnDef[] = [
  { id: "onboarding", title: "Onboarding", statuses: ["ONBOARDING"], color: "#7c3aed" },
  { id: "active",     title: "Active",     statuses: ["ACTIVE"],     color: "#16a34a" },
  { id: "bench",      title: "Bench",      statuses: ["BENCH"],      color: "#2563eb" },
  { id: "paused",     title: "Paused",     statuses: ["PAUSED"],     color: "#d97706" },
  { id: "alumni",     title: "Alumni",     statuses: ["ALUMNI"],     color: "#71717a" },
];

const STAGE_LABELS: Record<string, string> = {
  APPLICANT: "Applicant",
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  BENCH: "Bench",
  PAUSED: "Paused",
  ALUMNI: "Alumni",
};

const STAGE_COLORS: Record<string, string> = {
  APPLICANT: "#6b21c8",
  ONBOARDING: "#7c3aed",
  ACTIVE: "#16a34a",
  BENCH: "#2563eb",
  PAUSED: "#d97706",
  ALUMNI: "#71717a",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysInStage(enteredAt: string): number {
  return Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86_400_000);
}

function scoreBar(score: number | null) {
  if (score === null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <div style={{ flex: 1, height: 4, background: "#e5e7eb", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontWeight: 600, minWidth: 24 }}>{pct}</span>
    </div>
  );
}

// ── Tag chip ────────────────────────────────────────────────────────────────

function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  const bg = tag.color ?? "#e0e7ff";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color: "#1e1b4b",
        whiteSpace: "nowrap",
      }}
    >
      {tag.label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit", opacity: 0.6 }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── Kanban card ─────────────────────────────────────────────────────────────

type KanbanItem = InstructorOpsRow & { status: string };

function InstructorCard({
  item,
  handlers,
}: {
  item: KanbanItem;
  handlers: { onClick: () => void; isDragging?: boolean };
}) {
  const days = daysInStage(item.stageEnteredAt);
  return (
    <div
      className="kanban-card"
      onClick={handlers.onClick}
      style={{ opacity: handlers.isDragging ? 0.4 : 1 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.chapterName ?? "No chapter"}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {item.isOnHold && (
            <span style={{ fontSize: 10, padding: "1px 5px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontWeight: 600 }}>
              ON HOLD
            </span>
          )}
          {item.isLeadershipTrack && (
            <span style={{ fontSize: 10, padding: "1px 5px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, fontWeight: 600 }}>
              LEADERSHIP
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
        {days}d in stage
        {item.openTaskCount > 0 && (
          <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 600 }}>
            {item.openTaskCount} task{item.openTaskCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {item.readinessScore !== null && (
        <div style={{ marginTop: 6 }}>{scoreBar(item.readinessScore)}</div>
      )}

      {item.tags.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
          {item.tags.slice(0, 3).map((t) => (
            <TagChip key={t.tagId} tag={{ id: t.tagId, ...t } as Tag} />
          ))}
          {item.tags.length > 3 && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>+{item.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Directory row ────────────────────────────────────────────────────────────

function DirectoryRow({
  row,
  selected,
  onToggle,
  allTags,
  onTagAdd,
  onTagRemove,
}: {
  row: InstructorOpsRow;
  selected: boolean;
  onToggle: () => void;
  allTags: Tag[];
  onTagAdd: (userId: string, tagId: string) => void;
  onTagRemove: (userId: string, tagId: string) => void;
}) {
  const [showTagPicker, setShowTagPicker] = useState(false);
  const stageColor = STAGE_COLORS[row.lifecycleStage] ?? "#71717a";

  return (
    <tr style={{ background: selected ? "#f5f3ff" : undefined }}>
      <td style={{ width: 32 }}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td>
        <Link
          href={`/admin/instructors/${row.id}`}
          style={{ fontWeight: 600, fontSize: 13, textDecoration: "none", color: "inherit" }}
        >
          {row.name}
        </Link>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{row.email}</div>
      </td>
      <td style={{ fontSize: 12 }}>{row.chapterName ?? "—"}</td>
      <td>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 10,
            background: stageColor + "22",
            color: stageColor,
            fontWeight: 600,
          }}
        >
          {STAGE_LABELS[row.lifecycleStage]}
        </span>
      </td>
      <td style={{ fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 4, background: "#e5e7eb", borderRadius: 2, minWidth: 50 }}>
            <div
              style={{
                width: `${row.trainingPct}%`,
                height: "100%",
                background: row.trainingPct === 100 ? "#16a34a" : "#7c3aed",
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 28 }}>{row.trainingPct}%</span>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
          {row.tags.map((t) => (
            <TagChip
              key={t.tagId}
              tag={{ id: t.tagId, ...t } as Tag}
              onRemove={() => onTagRemove(row.id, t.tagId)}
            />
          ))}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowTagPicker((v) => !v)}
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 10,
                border: "1px dashed #d1d5db",
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
              }}
            >
              + tag
            </button>
            {showTagPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 50,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,.12)",
                  padding: 8,
                  minWidth: 160,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {allTags
                  .filter((t) => !row.tags.some((rt) => rt.tagId === t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onTagAdd(row.id, t.id);
                        setShowTagPicker(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "var(--muted)", marginRight: 4, fontSize: 10 }}>
                        {t.namespace.toLowerCase()}
                      </span>
                      {t.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ fontSize: 12 }}>{row.mentorName ?? "—"}</td>
      <td style={{ fontSize: 12 }}>
        {row.openTaskCount > 0 ? (
          <span style={{ color: "#dc2626", fontWeight: 600 }}>{row.openTaskCount}</span>
        ) : (
          "—"
        )}
      </td>
      <td>
        <Link href={`/admin/instructors/${row.id}`} style={{ fontSize: 12 }}>
          View →
        </Link>
      </td>
    </tr>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LifecycleBoardClient({
  instructors,
  chapters,
  mentors: _mentors,
  allTags,
  savedViews: initialSavedViews,
}: Props) {
  const [activeTab, setActiveTab] = useState<"board" | "directory">("board");
  const [isPending, startTransition] = useTransition();

  // filters
  const [search, setSearch] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [filterAttention, setFilterAttention] = useState(false);

  // selection (directory)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkStage, setBulkStage] = useState<InstructorLifecycleStage>("ACTIVE");
  const [bulkTagId, setBulkTagId] = useState("");

  // saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialSavedViews);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  // local optimistic data
  const [localData, setLocalData] = useState<InstructorOpsRow[]>(instructors);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return localData.filter((i) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.email.toLowerCase().includes(q) &&
          !(i.chapterName ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterChapter && i.chapterId !== filterChapter) return false;
      if (filterStage && i.lifecycleStage !== filterStage) return false;
      if (filterTagId && !i.tags.some((t) => t.tagId === filterTagId)) return false;
      if (filterAttention && i.openTaskCount === 0 && !i.isOnHold) return false;
      return true;
    });
  }, [localData, search, filterChapter, filterStage, filterTagId, filterAttention]);

  // ── Drag-and-drop stage change ─────────────────────────────────────────────

  const kanbanItems: KanbanItem[] = filtered
    .filter((i) => i.lifecycleStage !== "APPLICANT")
    .map((i) => ({ ...i, status: i.lifecycleStage }));

  function handleStageChange(itemId: string, newStatus: string, _prev: string) {
    const stage = newStatus as InstructorLifecycleStage;
    setLocalData((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, lifecycleStage: stage, stageEnteredAt: new Date().toISOString() }
          : i,
      ),
    );
    return updateInstructorLifecycleStage(itemId, stage)
      .then(() => ({ success: true }))
      .catch((e) => ({ success: false, error: String(e) }));
  }

  // ── Tag actions ────────────────────────────────────────────────────────────

  function handleTagAdd(userId: string, tagId: string) {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;
    setLocalData((prev) =>
      prev.map((i) =>
        i.id === userId
          ? {
              ...i,
              tags: i.tags.some((t) => t.tagId === tagId)
                ? i.tags
                : [...i.tags, { tagId, namespace: tag.namespace, slug: tag.slug, label: tag.label, color: tag.color }],
            }
          : i,
      ),
    );
    startTransition(() => { addTagToInstructor(userId, tagId); });
  }

  function handleTagRemove(userId: string, tagId: string) {
    setLocalData((prev) =>
      prev.map((i) =>
        i.id === userId ? { ...i, tags: i.tags.filter((t) => t.tagId !== tagId) } : i,
      ),
    );
    startTransition(() => { removeTagFromInstructor(userId, tagId); });
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  function handleBulkApply() {
    if (selectedIds.length === 0 || !bulkAction) return;
    startTransition(async () => {
      if (bulkAction === "stage") {
        await bulkUpdateLifecycleStage(selectedIds, bulkStage);
        setLocalData((prev) =>
          prev.map((i) =>
            selectedIds.includes(i.id)
              ? { ...i, lifecycleStage: bulkStage, stageEnteredAt: new Date().toISOString() }
              : i,
          ),
        );
      } else if (bulkAction === "tag" && bulkTagId) {
        await bulkAddTag(selectedIds, bulkTagId);
        const tag = allTags.find((t) => t.id === bulkTagId);
        if (tag) {
          setLocalData((prev) =>
            prev.map((i) =>
              selectedIds.includes(i.id) && !i.tags.some((t) => t.tagId === bulkTagId)
                ? {
                    ...i,
                    tags: [...i.tags, { tagId: tag.id, namespace: tag.namespace, slug: tag.slug, label: tag.label, color: tag.color }],
                  }
                : i,
            ),
          );
        }
      } else if (bulkAction === "hold") {
        await bulkSetOnHold(selectedIds, true);
        setLocalData((prev) =>
          prev.map((i) =>
            selectedIds.includes(i.id) ? { ...i, isOnHold: true } : i,
          ),
        );
      } else if (bulkAction === "unhold") {
        await bulkSetOnHold(selectedIds, false);
        setLocalData((prev) =>
          prev.map((i) =>
            selectedIds.includes(i.id) ? { ...i, isOnHold: false } : i,
          ),
        );
      }
      setSelectedIds([]);
    });
  }

  // ── Saved views ─────────────────────────────────────────────────────────────

  function applyView(view: SavedView) {
    const f = view.filters as Record<string, unknown>;
    if (typeof f.search === "string") setSearch(f.search);
    if (typeof f.filterChapter === "string") setFilterChapter(f.filterChapter);
    if (typeof f.filterStage === "string") setFilterStage(f.filterStage);
    if (typeof f.filterTagId === "string") setFilterTagId(f.filterTagId);
    if (typeof f.filterAttention === "boolean") setFilterAttention(f.filterAttention);
  }

  async function handleSaveView() {
    if (!newViewName.trim()) return;
    const result = await createSavedView({
      name: newViewName.trim(),
      filters: { search, filterChapter, filterStage, filterTagId, filterAttention },
    });
    if (result.success) {
      setSavedViews((prev) => [
        ...prev,
        result.view as SavedView,
      ]);
      setNewViewName("");
      setShowSaveView(false);
    }
  }

  async function handleDeleteView(id: string) {
    await deleteSavedView(id);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }

  // ── Toggle selection ────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.length === filtered.length ? [] : filtered.map((i) => i.id),
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const filterBar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <input
        placeholder="Search name, email, chapter…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={inputStyle}
      />
      <select value={filterChapter} onChange={(e) => setFilterChapter(e.target.value)} style={inputStyle}>
        <option value="">All chapters</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} style={inputStyle}>
        <option value="">All stages</option>
        {Object.entries(STAGE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select value={filterTagId} onChange={(e) => setFilterTagId(e.target.value)} style={inputStyle}>
        <option value="">All tags</option>
        {allTags.map((t) => (
          <option key={t.id} value={t.id}>{t.namespace.toLowerCase()}: {t.label}</option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={filterAttention}
          onChange={(e) => setFilterAttention(e.target.checked)}
        />
        Needs attention
      </label>

      {/* Saved views */}
      {savedViews.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {savedViews.map((v) => (
            <span key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button
                onClick={() => applyView(v)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                {v.name}
              </button>
              <button
                onClick={() => handleDeleteView(v.id)}
                style={{ fontSize: 11, border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowSaveView((v) => !v)}
        style={{ fontSize: 12, padding: "4px 10px", border: "1px dashed #d1d5db", borderRadius: 8, background: "none", cursor: "pointer" }}
      >
        + Save view
      </button>
      {showSaveView && (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <input
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="View name"
            style={{ ...inputStyle, width: 140 }}
          />
          <button
            onClick={handleSaveView}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Save
          </button>
        </span>
      )}

      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
        {filtered.length} / {localData.length} instructors
        {isPending && " · saving…"}
      </span>
    </div>
  );

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {(["board", "directory"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? "#7c3aed" : "var(--muted)",
              borderBottom: activeTab === tab ? "2px solid #7c3aed" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {tab === "board" ? "Lifecycle Board" : "Directory"}
          </button>
        ))}
      </div>

      {filterBar}

      {/* ── Board view ──────────────────────────────────────────────────── */}
      {activeTab === "board" && (
        <KanbanBoard
          items={kanbanItems}
          columns={LIFECYCLE_COLUMNS}
          dragEnabled
          onStatusChange={handleStageChange}
          getSearchText={(i) => `${i.name} ${i.email} ${i.chapterName ?? ""}`}
          searchPlaceholder="Search board…"
          renderCard={(item, handlers) => (
            <InstructorCard item={item} handlers={handlers} />
          )}
          renderDragOverlay={(item) => (
            <InstructorCard
              item={item}
              handlers={{ onClick: () => {}, isDragging: true }}
            />
          )}
        />
      )}

      {/* ── Directory view ───────────────────────────────────────────────── */}
      {activeTab === "directory" && (
        <div>
          {/* Bulk actions bar */}
          {selectedIds.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 14px",
                background: "#f5f3ff",
                borderRadius: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {selectedIds.length} selected
              </span>
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={inputStyle}>
                <option value="">Choose action…</option>
                <option value="stage">Change stage</option>
                <option value="tag">Add tag</option>
                <option value="hold">Put on hold</option>
                <option value="unhold">Remove hold</option>
              </select>
              {bulkAction === "stage" && (
                <select
                  value={bulkStage}
                  onChange={(e) => setBulkStage(e.target.value as InstructorLifecycleStage)}
                  style={inputStyle}
                >
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
              {bulkAction === "tag" && (
                <select value={bulkTagId} onChange={(e) => setBulkTagId(e.target.value)} style={inputStyle}>
                  <option value="">Select tag…</option>
                  {allTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleBulkApply}
                disabled={!bulkAction}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedIds([])}
                style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "none", fontSize: 13, cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Chapter</th>
                  <th style={thStyle}>Stage</th>
                  <th style={thStyle}>Training</th>
                  <th style={thStyle}>Tags</th>
                  <th style={thStyle}>Mentor</th>
                  <th style={thStyle}>Tasks</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <DirectoryRow
                      row={row}
                      selected={selectedIds.includes(row.id)}
                      onToggle={() => toggleSelect(row.id)}
                      allTags={allTags}
                      onTagAdd={handleTagAdd}
                      onTagRemove={handleTagRemove}
                    />
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)" }}>
                      No instructors match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 13,
  background: "#fff",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
