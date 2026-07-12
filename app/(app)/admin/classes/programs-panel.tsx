"use client";

import { useRouter } from "next/navigation";
import { useState, useOptimistic, startTransition } from "react";
import {
  createProgram,
  updateProgram,
  addProgramSession,
  deleteProgramSession,
  updateProgramTags,
} from "@/lib/program-actions";
import {
  PROGRAM_TYPE_CONFIG,
  getProgramColor,
  formatProgramType,
} from "@/lib/program-constants";
import type { ProgramType } from "@prisma/client";

const PROGRAM_TYPE_ORDER = Object.keys(PROGRAM_TYPE_CONFIG) as Array<keyof typeof PROGRAM_TYPE_CONFIG>;

type Program = {
  id: string;
  name: string;
  description: string | null;
  interestArea: string;
  type: string;
  isVirtual: boolean;
  isActive: boolean;
  leader: { id: string; name: string } | null;
  tags: string[];
  sessions: Array<{
    id: string;
    title: string;
    description: string | null;
    scheduledAt: Date;
    duration: number;
    meetingLink: string | null;
  }>;
  _count: { participants: number; sessions: number };
};

type Leader = { id: string; name: string; primaryRole: string };

export default function ProgramsPanel({
  programs,
  potentialLeaders,
}: {
  programs: Program[];
  potentialLeaders: Leader[];
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);
  const [activeTagInput, setActiveTagInput] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const [optimisticPrograms, addOptimisticProgram] = useOptimistic(
    programs,
    (state, action: { type: "add" | "remove" | "update"; program: Program }) => {
      if (action.type === "add") return [action.program, ...state];
      if (action.type === "remove") return state.filter((p) => p.id !== action.program.id);
      if (action.type === "update")
        return state.map((p) => (p.id === action.program.id ? action.program : p));
      return state;
    }
  );

  async function handleCreate(formData: FormData) {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const interestArea = formData.get("interestArea") as string;
    const description = formData.get("description") as string;
    const isVirtual = formData.get("isVirtual") === "true";
    const leaderId = formData.get("leaderId") as string;

    const result = await createProgram(formData);
    if (result?.id) {
      setIsCreating(false);
      router.refresh();
    }
  }

  async function handleAddSession(programId: string, formData: FormData) {
    await addProgramSession(programId, formData);
    router.refresh();
  }

  async function handleDeleteSession(sessionId: string) {
    await deleteProgramSession(sessionId);
    router.refresh();
  }

  async function handleUpdateTags(programId: string) {
    if (!tagInput.trim()) return;
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    await updateProgramTags(programId, tags);
    setActiveTagInput(null);
    setTagInput("");
    router.refresh();
  }

  async function handleRemoveTag(programId: string, tag: string) {
    const program = optimisticPrograms.find((p) => p.id === programId);
    if (!program) return;
    const newTags = program.tags.filter((t) => t !== tag);
    await updateProgramTags(programId, newTags);
    router.refresh();
  }

  const programTypes = PROGRAM_TYPE_ORDER;

  return (
    <div className="programs-panel">
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold m-0">Special Programs</h2>
          <p className="text-sm text-ink-muted m-0 mt-0.5">
            Manage programs, sessions, and summer program tags
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? "Cancel" : "New Program"}
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="card mb-4 p-4 border border-line-soft rounded-lg bg-white">
          <h3 className="text-sm font-semibold mb-3">Create New Program</h3>
          <form action={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="text-xs font-medium">Name</label>
                <input type="text" name="name" required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Math Olympiad Prep" />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium">Type</label>
                <select name="type" required className="w-full px-3 py-2 border rounded-lg text-sm">
                  {programTypes.map((type) => (
                    <option key={type} value={type}>
                      {PROGRAM_TYPE_CONFIG[type].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="text-xs font-medium">Interest Area</label>
                <input type="text" name="interestArea" required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Mathematics" />
              </div>
              <div className="form-group">
                <label className="text-xs font-medium">Leader</label>
                <select name="leaderId" className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">No leader</option>
                  {potentialLeaders.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="text-xs font-medium">Description</label>
              <textarea name="description" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" name="isVirtual" value="true" defaultChecked />
                Virtual
              </label>
              <button type="submit" className="btn btn-primary btn-sm">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Programs list */}
      <div className="space-y-3">
        {optimisticPrograms.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted text-sm">
            No programs created yet. Click "New Program" to get started.
          </div>
        ) : (
          optimisticPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              potentialLeaders={potentialLeaders}
              onAddSession={handleAddSession}
              onDeleteSession={handleDeleteSession}
              onUpdateTags={handleUpdateTags}
              onRemoveTag={handleRemoveTag}
              activeTagInput={activeTagInput}
              setActiveTagInput={setActiveTagInput}
              tagInput={tagInput}
              setTagInput={setTagInput}
            />
          ))
        )}
      </div>

      <style>{`
        .programs-panel .form-group {
          margin-bottom: 0;
        }
        .programs-panel .form-group label {
          display: block;
          margin-bottom: 0.25rem;
        }
        .programs-panel input, .programs-panel select, .programs-panel textarea {
          width: 100%;
        }
        .programs-panel .btn-sm {
          padding: 0.4rem 0.75rem;
          font-size: 0.8125rem;
        }
      `}</style>
    </div>
  );
}

function ProgramCard({
  program,
  potentialLeaders,
  onAddSession,
  onDeleteSession,
  onUpdateTags,
  onRemoveTag,
  activeTagInput,
  setActiveTagInput,
  tagInput,
  setTagInput,
}: {
  program: Program;
  potentialLeaders: Leader[];
  onAddSession: (programId: string, formData: FormData) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onUpdateTags: (programId: string) => Promise<void>;
  onRemoveTag: (programId: string, tag: string) => Promise<void>;
  activeTagInput: string | null;
  setActiveTagInput: (id: string | null) => void;
  tagInput: string;
  setTagInput: (val: string) => void;
}) {
  return (
    <div className="card p-4 border border-line-soft rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: getProgramColor(program.type) }}
            >
              {formatProgramType(program.type)}
            </span>
            {program.isVirtual && (
              <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                Virtual
              </span>
            )}
            {!program.isActive && (
              <span className="text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold m-0">{program.name}</h3>
          <p className="text-xs text-ink-muted m-0 mt-0.5">{program.interestArea}</p>
        </div>
        <div className="text-right text-xs text-ink-muted shrink-0 ml-3">
          <div>{program._count.participants} enrolled</div>
          <div>{program._count.sessions} sessions</div>
        </div>
      </div>

      {program.leader && (
        <p className="text-xs text-ink-muted mb-2">Led by: {program.leader.name}</p>
      )}

      {/* Tags */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {program.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full"
            >
              {tag}
              <button
                type="button"
                className="text-orange-400 hover:text-orange-600 leading-none text-xs"
                onClick={() => onRemoveTag(program.id, tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          {activeTagInput === program.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateTags(program.id);
              }}
              className="inline-flex items-center gap-1"
            >
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag1, tag2, ..."
                className="text-[11px] px-2 py-1 border rounded w-40"
                autoFocus
              />
              <button type="submit" className="text-[11px] text-brand-700 font-medium">
                Add
              </button>
              <button
                type="button"
                className="text-[11px] text-ink-muted"
                onClick={() => setActiveTagInput(null)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="text-[11px] text-brand-600 hover:text-brand-800 font-medium"
              onClick={() => {
                setActiveTagInput(program.id);
                setTagInput(program.tags?.join(", ") || "");
              }}
            >
              + Tags
            </button>
          )}
        </div>
      </div>

      {/* Sessions */}
      <details className="group mt-2">
        <summary className="cursor-pointer text-sm font-medium text-brand-700 list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform">▶</span>
          Sessions ({program.sessions.length})
        </summary>
        <div className="mt-2 pl-4 border-l-2 border-line-soft space-y-2">
          {program.sessions.length === 0 ? (
            <p className="text-xs text-ink-muted italic">No sessions scheduled</p>
          ) : (
            program.sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 text-sm py-1">
                <span className="text-xs text-ink-muted w-24 shrink-0">
                  {new Date(session.scheduledAt).toLocaleDateString()}
                </span>
                <span className="flex-1 font-medium truncate">{session.title}</span>
                <span className="text-xs text-ink-muted">{session.duration}min</span>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={`Delete session ${session.title}`}
                >
                  ✕
                </button>
              </div>
            ))
          )}

          {/* Add session form */}
          <form
            action={async (formData) => {
              await onAddSession(program.id, formData);
            }}
            className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-ink-muted block mb-0.5">Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-2 py-1.5 border rounded text-sm"
                  placeholder="Session title"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-ink-muted block mb-0.5">Date & Time</label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-ink-muted block mb-0.5">Duration (min)</label>
                <input
                  type="number"
                  name="duration"
                  defaultValue={60}
                  min={15}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-ink-muted block mb-0.5">Meeting Link</label>
                <input
                  type="url"
                  name="meetingLink"
                  className="w-full px-2 py-1.5 border rounded text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm mt-1">
              Add Session
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}