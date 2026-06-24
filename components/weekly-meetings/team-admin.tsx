"use client";

/**
 * Admin Teams manager — create/rename/archive teams and assign members
 * (many-to-many, with an optional lead flag).
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, CardV2, StatusBadge, ToastV2 } from "@/components/ui-v2";
import type { AssignableUser, TeamDTO } from "@/lib/weekly-meetings/teams";
import {
  addTeamMember,
  archiveTeam,
  createTeam,
  removeTeamMember,
  setMemberLead,
  updateTeam,
} from "@/lib/weekly-meetings/team-actions";

const inputCls =
  "rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

export function TeamAdmin({ teams, users }: { teams: TeamDTO[]; users: AssignableUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function run(fn: () => Promise<unknown>, msg?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (msg) setToast(msg);
        router.refresh();
      } catch {
        setToast("Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <CardV2 padding="md">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              New team
            </label>
            <input
              className={`${inputCls} w-full`}
              placeholder="e.g. Tech"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            loading={pending}
            disabled={!newName.trim()}
            onClick={() =>
              run(async () => {
                await createTeam({ name: newName.trim() });
                setNewName("");
              }, "Team created")
            }
          >
            Create team
          </Button>
        </div>
      </CardV2>

      {teams.map((team) => (
        <TeamCard key={team.id} team={team} users={users} pending={pending} run={run} />
      ))}

      {teams.length === 0 && (
        <p className="text-[14px] text-ink-muted">No teams yet — create your first team above.</p>
      )}

      {toast && (
        <ToastV2 open tone="success">
          {toast}
        </ToastV2>
      )}
    </div>
  );
}

function TeamCard({
  team,
  users,
  pending,
  run,
}: {
  team: TeamDTO;
  users: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>, msg?: string) => void;
}) {
  const [name, setName] = useState(team.name);
  const [addId, setAddId] = useState("");
  const memberIds = new Set(team.members.map((m) => m.userId));
  const available = users.filter((u) => !memberIds.has(u.id));

  return (
    <CardV2 padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} font-semibold`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== team.name && run(() => updateTeam({ teamId: team.id, name: name.trim() }), "Renamed")}
          />
          <span className="text-[12px] text-ink-muted">/{team.slug}</span>
          {team.status === "ARCHIVED" && <StatusBadge tone="neutral">Archived</StatusBadge>}
        </div>
        {team.status === "ACTIVE" && (
          <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => archiveTeam({ teamId: team.id }), "Archived")}>
            Archive
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {team.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-2">
            <div className="min-w-0">
              <p className="m-0 truncate text-[13px] font-medium text-ink">{m.name}</p>
              <p className="m-0 truncate text-[11.5px] text-ink-muted">{m.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand-600"
                  checked={m.isLead}
                  onChange={(e) => run(() => setMemberLead({ teamId: team.id, userId: m.userId, isLead: e.target.checked }))}
                />
                Lead
              </label>
              <button
                type="button"
                className="text-[12px] text-ink-muted hover:text-danger-700"
                onClick={() => run(() => removeTeamMember({ teamId: team.id, userId: m.userId }))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {team.members.length === 0 && <p className="m-0 text-[12.5px] text-ink-muted">No members yet.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={inputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Add a member…</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          loading={pending}
          disabled={!addId}
          onClick={() =>
            run(async () => {
              await addTeamMember({ teamId: team.id, userId: addId });
              setAddId("");
            })
          }
        >
          Add
        </Button>
      </div>
    </CardV2>
  );
}
