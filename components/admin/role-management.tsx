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
import {
  ADMIN_SUBTYPE_LABELS,
  ADMIN_SUBTYPE_VALUES,
  normalizeAdminSubtype,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";
import { formatAccessLabel } from "@/lib/admin-user-access";
import { setUserAccess } from "@/lib/admin/role-management-actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  chapterId: string | null;
  chapterName: string | null;
  roles: string[];
  adminSubtypes: string[];
  defaultOwnerSubtype: string | null;
};

type ChapterOption = { id: string; name: string; city: string | null };

const ROLE_VALUES = Object.values(RoleType);

const KEEP_CHAPTER = "__KEEP__";
const CLEAR_CHAPTER = "__CLEAR__";

export function RoleManagement({
  users,
  chapters,
}: {
  users: UserRow[];
  chapters: ChapterOption[];
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ tone: "positive" | "danger"; text: string } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.primaryRole.toLowerCase().includes(q)
    );
  }, [query, users]);

  return (
    <div className="flex flex-col gap-4">
      <CardV2 className="flex flex-col gap-4">
        <SearchInputV2
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or role…"
        />
        <p className="text-sm text-muted">
          {filtered.length} of {users.length} users
        </p>

        {filtered.length === 0 ? (
          <EmptyStateV2
            title="No users match"
            description="Try a different name, email, or role."
          />
        ) : (
          <DataTableShell>
            <TableV2>
              <thead>
                <tr>
                  <TableHeadCell>Name</TableHeadCell>
                  <TableHeadCell>Primary role</TableHeadCell>
                  <TableHeadCell>Roles</TableHeadCell>
                  <TableHeadCell>Chapter</TableHeadCell>
                  <TableHeadCell className="text-right">Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone="brand">
                        {formatAccessLabel(user.primaryRole)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-full bg-surface-alt px-2 py-0.5 text-xs"
                            >
                              {formatAccessLabel(role)}
                            </span>
                          ))
                        )}
                        {user.adminSubtypes.map((raw) => {
                          const subtype = normalizeAdminSubtype(raw);
                          return (
                            <span
                              key={raw}
                              className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                            >
                              {subtype ? ADMIN_SUBTYPE_LABELS[subtype] : raw}
                            </span>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{user.chapterName ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditing(user)}
                      >
                        Edit roles
                      </Button>
                    </TableCell>
                  </tr>
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
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setToast({ tone: "positive", text: `${name}'s access was updated.` });
          }}
          onError={(text) => setToast({ tone: "danger", text })}
        />
      ) : null}

      <ToastV2
        open={Boolean(toast)}
        tone={toast?.tone === "danger" ? "danger" : "success"}
      >
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

function EditAccessModal({
  user,
  chapters,
  onClose,
  onSaved,
  onError,
}: {
  user: UserRow;
  chapters: ChapterOption[];
  onClose: () => void;
  onSaved: (name: string) => void;
  onError: (message: string) => void;
}) {
  const [primaryRole, setPrimaryRole] = useState(user.primaryRole);
  const [roles, setRoles] = useState<Set<string>>(new Set(user.roles));
  const [subtypes, setSubtypes] = useState<Set<string>>(
    new Set(user.adminSubtypes.map((s) => normalizeAdminSubtype(s)).filter(Boolean) as string[])
  );
  const [defaultOwner, setDefaultOwner] = useState<string>(
    normalizeAdminSubtype(user.defaultOwnerSubtype) ?? ""
  );
  const [chapterChoice, setChapterChoice] = useState<string>(KEEP_CHAPTER);
  const [pending, startTransition] = useTransition();

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function save() {
    startTransition(async () => {
      try {
        await setUserAccess({
          userId: user.id,
          primaryRole,
          roles: Array.from(roles),
          adminSubtypes: Array.from(subtypes),
          defaultOwnerSubtype: defaultOwner || null,
          chapterId: chapterChoice,
        });
        onSaved(user.name);
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "Could not update access."
        );
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
          Edit roles — {user.name}
        </h2>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Primary role</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2"
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

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Roles</legend>
          <p className="text-xs text-muted">
            The primary role is always kept. Selecting any admin subtype adds the
            Admin role automatically.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_VALUES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roles.has(role)}
                  onChange={() => setRoles((s) => toggle(s, role))}
                />
                {formatAccessLabel(role)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Admin subtypes</legend>
          <div className="grid grid-cols-2 gap-2">
            {ADMIN_SUBTYPE_VALUES.map((subtype: AdminSubtypeValue) => (
              <label key={subtype} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subtypes.has(subtype)}
                  onChange={() =>
                    setSubtypes((s) => {
                      const next = toggle(s, subtype);
                      if (!next.has(subtype) && defaultOwner === subtype) {
                        setDefaultOwner("");
                      }
                      return next;
                    })
                  }
                />
                {ADMIN_SUBTYPE_LABELS[subtype]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Default owner subtype</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2"
            value={defaultOwner}
            onChange={(e) => setDefaultOwner(e.target.value)}
          >
            <option value="">None</option>
            {ADMIN_SUBTYPE_VALUES.filter((s) => subtypes.has(s)).map((subtype) => (
              <option key={subtype} value={subtype}>
                {ADMIN_SUBTYPE_LABELS[subtype]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Chapter</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2"
            value={chapterChoice}
            onChange={(e) => setChapterChoice(e.target.value)}
          >
            <option value={KEEP_CHAPTER}>
              Keep current ({user.chapterName ?? "None"})
            </option>
            <option value={CLEAR_CHAPTER}>Clear chapter</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
                {chapter.city ? ` (${chapter.city})` : ""}
              </option>
            ))}
          </select>
        </label>
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
