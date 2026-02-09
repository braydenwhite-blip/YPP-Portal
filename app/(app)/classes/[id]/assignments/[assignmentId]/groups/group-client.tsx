"use client";

import { useState } from "react";
import {
  createGroupProject,
  joinGroupProject,
  addGroupMilestone,
  toggleMilestoneComplete,
} from "@/lib/assignment-actions";
import { useRouter } from "next/navigation";

interface GroupOption {
  id: string;
  groupName: string;
  memberCount: number;
  maxSize: number;
}

export function GroupProjectClient({
  assignmentId,
  offeringId,
  mode,
  groups,
  groupId,
}: {
  assignmentId: string;
  offeringId: string;
  mode: "create" | "milestone";
  groups?: GroupOption[];
  groupId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (mode === "create") {
    return (
      <div style={{ marginTop: 16 }}>
        {!showForm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => setShowForm(true)} className="button primary" style={{ fontSize: 13, width: "100%" }}>
              Create New Group
            </button>
            {/* Join existing group */}
            {groups && groups.filter((g) => g.memberCount < g.maxSize).length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
                or join an existing group above
              </div>
            )}
          </div>
        ) : (
          <CreateGroupForm
            assignmentId={assignmentId}
            offeringId={offeringId}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            router={router}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    );
  }

  // Milestone mode
  return (
    <div style={{ marginTop: 16 }}>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="button secondary" style={{ fontSize: 13 }}>
          + Add Milestone
        </button>
      ) : (
        <AddMilestoneForm
          groupId={groupId!}
          loading={loading}
          setLoading={setLoading}
          error={error}
          setError={setError}
          router={router}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function CreateGroupForm({
  assignmentId,
  offeringId,
  loading,
  setLoading,
  error,
  setError,
  router,
  onCancel,
}: {
  assignmentId: string;
  offeringId: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  router: ReturnType<typeof useRouter>;
  onCancel: () => void;
}) {
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("assignmentId", assignmentId);
      const result = await createGroupProject(formData);
      router.push(`/classes/${offeringId}/assignments/${assignmentId}/groups?group=${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Group Name *</label>
        <input name="groupName" className="form-input" required placeholder="e.g., The Color Crew" />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea name="description" className="form-input" rows={2} placeholder="What's your group's vibe?" />
      </div>
      <div className="form-group">
        <label className="form-label">Communication Channel</label>
        <input name="communicationChannel" className="form-input" placeholder="e.g., Group text, Discord, Slack" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading} style={{ fontSize: 13 }}>
          {loading ? "Creating..." : "Create Group"}
        </button>
        <button type="button" className="button secondary" onClick={onCancel} style={{ fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddMilestoneForm({
  groupId,
  loading,
  setLoading,
  error,
  setError,
  router,
  onCancel,
}: {
  groupId: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  router: ReturnType<typeof useRouter>;
  onCancel: () => void;
}) {
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("groupId", groupId);
      await addGroupMilestone(formData);
      onCancel();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add milestone");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleAdd} style={{ padding: 12, background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
      {error && (
        <div style={{ padding: "6px 10px", background: "#fef2f2", color: "#dc2626", borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div className="form-group">
        <input name="title" className="form-input" required placeholder="Milestone title" style={{ fontSize: 13 }} />
      </div>
      <div className="form-group">
        <input name="targetDate" type="date" className="form-input" style={{ fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "Adding..." : "Add"}
        </button>
        <button type="button" className="button secondary" onClick={onCancel} style={{ fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Export for use in milestone toggle
export function MilestoneToggle({ milestoneId }: { milestoneId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleMilestoneComplete(milestoneId);
      router.refresh();
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? "..." : "Toggle"}
    </button>
  );
}
