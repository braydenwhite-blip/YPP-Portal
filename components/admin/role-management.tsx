"use client";

import { useMemo, useState, useTransition } from "react";
import { RoleType } from "@prisma/client";

import {
  Button,
  CardV2,
  DataTableShell,
  TableV2,
  TableHeadCell,
  TableCell,
  ModalV2,
  ModalFooterV2,
  ToastV2,
  SearchInputV2,
  StatusBadge,
  EmptyStateV2,
} from "@/components/ui-v2";
import { formatAccessLabel } from "@/lib/admin-user-access";
import {
  INSTRUCTION_TITLES,
  LEADERSHIP_TITLES,
  TITLE_AUTHORITY,
  type CanonicalTitle,
} from "@/lib/org/levels";
import { ladderCapabilities } from "@/lib/org/capabilities";
import {
  createCohort,
  setUserAccess,
  setUserGroup,
} from "@/lib/admin/role-management-actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  canonicalTitle: string | null;
  ladder: string | null;
  internalLevel: number | null;
  chapterId: string | null;
  chapterName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  orgFunctionId: string | null;
  orgFunctionName: string | null;
  orgDepartmentId: string | null;
  orgDepartmentName: string | null;
  roles: string[];
};

type ChapterOption = { id: string; name: string; city: string | null };
type CohortOption = { id: string; name: string };
type FunctionOption = { id: string; name: string; slug: string };
type DepartmentOption = { id: string; name: string; functionId: string | null };

const ROLE_VALUES = Object.values(RoleType);

const KEEP = "__KEEP__";
const CLEAR = "__CLEAR__";
const NONE = "__NONE__";

/** A canonical title with its ladder + level, for the group dropdowns. */
const TITLE_GROUPS: { label: string; titles: readonly string[] }[] = [
  { label: "Instruction ladder", titles: INSTRUCTION_TITLES },
  { label: "Leadership ladder", titles: LEADERSHIP_TITLES },
];

// Numeric levels are purely internal — show the title name only.
function titleLabel(title: string): string {
  return title;
}

/** Roles an admin may toggle by hand. ADMIN is derived from the ladder title. */
const ASSIGNABLE_ROLE_VALUES = ROLE_VALUES.filter((role) => role !== RoleType.ADMIN);

/** A one-line, human summary of what a ladder title grants — for the editor. */
function titleAccessSummary(title: string): string | null {
  const meta = TITLE_AUTHORITY[title as keyof typeof TITLE_AUTHORITY];
  if (!meta) return null;
  const caps = ladderCapabilities({
    title: title as CanonicalTitle,
    ladder: meta.ladder,
    ladderLevel: meta.ladderLevel,
    internalLevel: meta.internalLevel,
    source: "PERSISTED",
  });
  if (caps.hasUniversalAccess) {
    return caps.canSeeOfficerReviews
      ? "Full universal access, including officer reviews (Board)."
      : "Universal access — can create & manage chapters, roles, and people.";
  }
  const grants: string[] = [];
  if (caps.canAccessGlobalActionTracker) grants.push("global action tracker");
  else if (caps.canAccessChapterActionTracker) grants.push("chapter action tracker");
  if (caps.canAccessInstructionCommittee) grants.push("Instruction Committee");
  else if (caps.canMentorInstructors) grants.push("mentor instructors");
  if (caps.canAccessOutreachDatabases) grants.push("outreach databases");
  grants.push(caps.canLeadActions ? "can lead actions" : "actions: executing/input only");
  return grants.length ? `Grants: ${grants.join(", ")}.` : null;
}

export function RoleManagement({
  users: initialUsers,
  chapters,
  cohorts: initialCohorts,
  functions = [],
  departments = [],
}: {
  users: UserRow[];
  chapters: ChapterOption[];
  cohorts: CohortOption[];
  functions?: FunctionOption[];
  departments?: DepartmentOption[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [cohorts, setCohorts] = useState<CohortOption[]>(initialCohorts);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.primaryRole.toLowerCase().includes(q) ||
        (u.canonicalTitle ?? "").toLowerCase().includes(q) ||
        (u.cohortName ?? "").toLowerCase().includes(q) ||
        (u.orgFunctionName ?? "").toLowerCase().includes(q) ||
        (u.orgDepartmentName ?? "").toLowerCase().includes(q)
    );
  }, [query, users]);

  function patchUser(id: string, patch: Partial<UserRow>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  return (
    <div className="flex flex-col gap-4">
      <CohortBar
        cohorts={cohorts}
        onCreated={(cohort) => {
          setCohorts((prev) =>
            [...prev, cohort].sort((a, b) => a.name.localeCompare(b.name))
          );
          setToast({ tone: "success", text: `Cohort "${cohort.name}" created.` });
        }}
        onError={(text) => setToast({ tone: "danger", text })}
      />

      <CardV2 className="flex flex-col gap-4">
        <SearchInputV2
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, role, title, or cohort…"
        />
        <p className="text-sm text-ink-muted">
          {filtered.length} of {users.length} users
        </p>

        {filtered.length === 0 ? (
          <EmptyStateV2
            title="No users match"
            body="Try a different name, email, role, title, or cohort."
          />
        ) : (
          <DataTableShell>
            <TableV2>
              <thead>
                <tr>
                  <TableHeadCell>Name</TableHeadCell>
                  <TableHeadCell>Primary role</TableHeadCell>
                  <TableHeadCell>Group (ladder / level)</TableHeadCell>
                  <TableHeadCell>Cohort</TableHeadCell>
                  <TableHeadCell>Chapter</TableHeadCell>
                  <TableHeadCell className="text-right">Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <UserRowView
                    key={user.id}
                    user={user}
                    cohorts={cohorts}
                    onPatch={patchUser}
                    onEdit={() => setEditing(user)}
                    onError={(text) => setToast({ tone: "danger", text })}
                    onSaved={(text) => setToast({ tone: "success", text })}
                  />
                ))}
              </tbody>
            </TableV2>
          </DataTableShell>
        )}
      </CardV2>

      {editing ? (
        <EditAccessModal
          key={editing.id}
          user={editing}
          chapters={chapters}
          cohorts={cohorts}
          functions={functions}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            patchUser(editing.id, patch);
            setEditing(null);
            setToast({ tone: "success", text: `${editing.name}'s access was updated.` });
          }}
          onError={(text) => setToast({ tone: "danger", text })}
        />
      ) : null}

      <ToastV2 open={Boolean(toast)} tone={toast?.tone === "danger" ? "danger" : "success"}>
        <div className="flex items-center gap-3">
          <span>{toast?.text}</span>
          <button
            type="button"
            className="text-xs underline opacity-80"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      </ToastV2>
    </div>
  );
}

function UserRowView({
  user,
  cohorts,
  onPatch,
  onEdit,
  onError,
  onSaved,
}: {
  user: UserRow;
  cohorts: CohortOption[];
  onPatch: (id: string, patch: Partial<UserRow>) => void;
  onEdit: () => void;
  onError: (text: string) => void;
  onSaved: (text: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function assignTitle(value: string) {
    const prev = { canonicalTitle: user.canonicalTitle, ladder: user.ladder, internalLevel: user.internalLevel };
    const meta = value ? TITLE_AUTHORITY[value as keyof typeof TITLE_AUTHORITY] : null;
    // Optimistic update.
    onPatch(user.id, {
      canonicalTitle: value || null,
      ladder: meta?.ladder ?? null,
      internalLevel: meta?.internalLevel ?? null,
    });
    startTransition(async () => {
      try {
        await setUserGroup({ userId: user.id, title: value ? value : CLEAR });
        onSaved(`${user.name} moved to ${value || "no ladder/level"}.`);
      } catch (error) {
        onPatch(user.id, prev);
        onError(error instanceof Error ? error.message : "Could not update group.");
      }
    });
  }

  function assignCohort(value: string) {
    const prev = { cohortId: user.cohortId, cohortName: user.cohortName };
    const cohort = cohorts.find((c) => c.id === value) ?? null;
    onPatch(user.id, {
      cohortId: value === NONE ? null : value,
      cohortName: value === NONE ? null : cohort?.name ?? null,
    });
    startTransition(async () => {
      try {
        await setUserGroup({ userId: user.id, cohortId: value });
        onSaved(`${user.name} assigned to ${cohort?.name ?? "no cohort"}.`);
      } catch (error) {
        onPatch(user.id, prev);
        onError(error instanceof Error ? error.message : "Could not update cohort.");
      }
    });
  }

  return (
    <tr>
      <TableCell>
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-ink-muted">{user.email}</div>
        {user.roles.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <span key={role} className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px]">
                {formatAccessLabel(role)}
              </span>
            ))}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusBadge tone="brand">{formatAccessLabel(user.primaryRole)}</StatusBadge>
      </TableCell>
      <TableCell>
        <select
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm disabled:opacity-60"
          value={user.canonicalTitle ?? ""}
          disabled={pending}
          onChange={(e) => assignTitle(e.target.value)}
        >
          <option value="">— None —</option>
          {TITLE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.titles.map((title) => (
                <option key={title} value={title}>
                  {titleLabel(title)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <select
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm disabled:opacity-60"
          value={user.cohortId ?? NONE}
          disabled={pending}
          onChange={(e) => assignCohort(e.target.value)}
        >
          <option value={NONE}>— No cohort —</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <span className="text-sm">{user.chapterName ?? "—"}</span>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="secondary" size="sm" onClick={onEdit} disabled={pending}>
          Edit
        </Button>
      </TableCell>
    </tr>
  );
}

function CohortBar({
  cohorts,
  onCreated,
  onError,
}: {
  cohorts: CohortOption[];
  onCreated: (cohort: CohortOption) => void;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await createCohort({ name: trimmed });
        if (res?.cohort) onCreated(res.cohort);
        setName("");
      } catch (error) {
        onError(error instanceof Error ? error.message : "Could not create cohort.");
      }
    });
  }

  return (
    <CardV2 className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold">Cohorts (groups)</h3>
        <p className="text-xs text-ink-muted">
          {cohorts.length} cohort{cohorts.length === 1 ? "" : "s"}. Assign people to a
          cohort inline in the table; moving someone keeps their account and history.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">New cohort</span>
          <input
            className="rounded-lg border border-line bg-surface px-3 py-2"
            value={name}
            placeholder="e.g. Spring 2026"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
        </label>
        <Button variant="primary" loading={pending} onClick={create} disabled={!name.trim()}>
          Create
        </Button>
      </div>
    </CardV2>
  );
}

function EditAccessModal({
  user,
  chapters,
  cohorts,
  functions,
  departments,
  onClose,
  onSaved,
  onError,
}: {
  user: UserRow;
  chapters: ChapterOption[];
  cohorts: CohortOption[];
  functions: FunctionOption[];
  departments: DepartmentOption[];
  onClose: () => void;
  onSaved: (patch: Partial<UserRow>) => void;
  onError: (message: string) => void;
}) {
  const [primaryRole, setPrimaryRole] = useState(user.primaryRole);
  const [roles, setRoles] = useState<Set<string>>(new Set(user.roles));
  const [title, setTitle] = useState<string>(user.canonicalTitle ?? "");
  const [cohortId, setCohortId] = useState<string>(user.cohortId ?? NONE);
  const [chapterChoice, setChapterChoice] = useState<string>(KEEP);
  const [orgFunctionId, setOrgFunctionId] = useState<string>(user.orgFunctionId ?? CLEAR);
  const [orgDepartmentId, setOrgDepartmentId] = useState<string>(
    user.orgDepartmentId ?? CLEAR
  );
  const [pending, startTransition] = useTransition();

  const departmentsForFunction = departments.filter(
    (d) =>
      !orgFunctionId ||
      orgFunctionId === CLEAR ||
      orgFunctionId === KEEP ||
      d.functionId === orgFunctionId
  );

  function toggleRole(value: string) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        await setUserAccess({
          userId: user.id,
          primaryRole,
          roles: Array.from(roles),
          chapterId: chapterChoice,
          title: title ? title : CLEAR,
          cohortId,
          orgFunctionId,
          orgDepartmentId,
        });
        const meta = title ? TITLE_AUTHORITY[title as keyof typeof TITLE_AUTHORITY] : null;
        const cohort = cohorts.find((c) => c.id === cohortId) ?? null;
        const chapter =
          chapterChoice === CLEAR
            ? null
            : chapterChoice === KEEP
              ? { id: user.chapterId, name: user.chapterName }
              : chapters.find((c) => c.id === chapterChoice) ?? null;
        const fn =
          orgFunctionId === CLEAR
            ? null
            : functions.find((f) => f.id === orgFunctionId) ?? null;
        const dept =
          orgDepartmentId === CLEAR
            ? null
            : departments.find((d) => d.id === orgDepartmentId) ?? null;
        onSaved({
          primaryRole,
          roles: Array.from(roles),
          canonicalTitle: title || null,
          ladder: meta?.ladder ?? null,
          internalLevel: meta?.internalLevel ?? null,
          cohortId: cohortId === NONE ? null : cohortId,
          cohortName: cohortId === NONE ? null : cohort?.name ?? null,
          chapterId: chapter?.id ?? null,
          chapterName: chapter?.name ?? null,
          orgFunctionId: fn?.id ?? null,
          orgFunctionName: fn?.name ?? null,
          orgDepartmentId: dept?.id ?? null,
          orgDepartmentName: dept?.name ?? null,
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : "Could not update access.");
      }
    });
  }

  return (
    <ModalV2
      open
      onClose={pending ? () => {} : onClose}
      locked={pending}
      accent="brand"
      labelledBy="edit-access-title"
    >
      <div>
        <h2 id="edit-access-title" className="text-lg font-semibold">
          Edit access — {user.name}
        </h2>
        <p className="text-sm text-ink-muted">{user.email}</p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Primary role</span>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2"
            value={primaryRole}
            onChange={(e) => setPrimaryRole(e.target.value)}
          >
            {ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {formatAccessLabel(role)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Group (ladder / level)</span>
            <select
              className="rounded-lg border border-line bg-surface px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              <option value="">— None —</option>
              {TITLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.titles.map((t) => (
                    <option key={t} value={t}>
                      {titleLabel(t)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-xs text-ink-muted">
              {title
                ? titleAccessSummary(title) ?? "Sets the ladder that drives permissions."
                : "Sets the ladder that drives all access. Officer and above grant admin access automatically."}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Cohort</span>
            <select
              className="rounded-lg border border-line bg-surface px-3 py-2"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              <option value={NONE}>— No cohort —</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Extra roles</legend>
          <p className="text-xs text-ink-muted">
            The primary role is always kept. Add any extra roles this person needs.
            Admin access is set by the ladder title above, not here.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ASSIGNABLE_ROLE_VALUES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roles.has(role)}
                  onChange={() => toggleRole(role)}
                />
                {formatAccessLabel(role)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Chapter</span>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2"
            value={chapterChoice}
            onChange={(e) => setChapterChoice(e.target.value)}
          >
            <option value={KEEP}>Keep current ({user.chapterName ?? "None"})</option>
            <option value={CLEAR}>Clear chapter</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
                {chapter.city ? ` (${chapter.city})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Function</span>
            <select
              className="rounded-lg border border-line bg-surface px-3 py-2"
              value={orgFunctionId}
              onChange={(e) => {
                setOrgFunctionId(e.target.value);
                setOrgDepartmentId(CLEAR);
              }}
            >
              <option value={CLEAR}>— No function —</option>
              {functions.map((fn) => (
                <option key={fn.id} value={fn.id}>
                  {fn.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Department</span>
            <select
              className="rounded-lg border border-line bg-surface px-3 py-2"
              value={orgDepartmentId}
              onChange={(e) => setOrgDepartmentId(e.target.value)}
              disabled={!orgFunctionId || orgFunctionId === CLEAR}
            >
              <option value={CLEAR}>— No department —</option>
              {departmentsForFunction.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ModalFooterV2>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" loading={pending} onClick={save}>
          Save access
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}
