"use client";

import { useMemo, useState, useTransition } from "react";
import { RoleType } from "@prisma/client";

import {
  Button,
  DataTableShell,
  EmptyStateV2,
  SearchInputV2,
  TableCell,
  TableHeadCell,
  TableV2,
  ToastV2,
} from "@/components/ui-v2";
import {
  createCohort,
  setUserGroup,
  updateAdminUserRow,
} from "@/lib/admin/role-management-actions";
import { formatAccessLabel } from "@/lib/admin-user-access";
import {
  INSTRUCTION_TITLES,
  LEADERSHIP_TITLES,
  TITLE_AUTHORITY,
} from "@/lib/org/levels";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  roles: string[];
  canonicalTitle: string | null;
  ladder: string | null;
  internalLevel: number | null;
  chapterId: string | null;
  chapterName: string | null;
  location: string | null;
  cohortId: string | null;
  cohortName: string | null;
  archivedAt: string | Date | null;
};

type ChapterOption = { id: string; name: string; city: string | null };
type CohortOption = { id: string; name: string };

const NONE = "__NONE__";
const CLEAR = "__CLEAR__";

const ROLE_OPTIONS = Object.values(RoleType);

const TITLE_GROUPS = [
  { label: "Instruction", titles: INSTRUCTION_TITLES },
  { label: "Leadership", titles: LEADERSHIP_TITLES },
] as const;

const selectClass =
  "h-9 w-full min-w-[8.5rem] max-w-[15rem] cursor-pointer rounded-[8px] border border-transparent bg-surface-soft px-2.5 text-[13px] text-ink outline-none transition-colors hover:border-line hover:bg-surface focus:border-brand-400 focus:bg-surface disabled:opacity-55";

const locationInputClass =
  "h-9 w-full min-w-[7.5rem] max-w-[13rem] rounded-[8px] border border-transparent bg-surface-soft px-2.5 text-[13px] text-ink outline-none transition-colors hover:border-line hover:bg-surface focus:border-brand-400 focus:bg-surface disabled:opacity-55";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function AdminUsersTable({
  users: initialUsers,
  chapters,
  cohorts: initialCohorts,
  locationOptions = [],
}: {
  users: AdminUserRow[];
  chapters: ChapterOption[];
  cohorts: CohortOption[];
  locationOptions?: string[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [cohorts, setCohorts] = useState(initialCohorts);
  const [locations, setLocations] = useState(locationOptions);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showCohortCreate, setShowCohortCreate] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null
  );

  const locationListId = "admin-user-location-options";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.primaryRole !== roleFilter) return false;
      if (!q) return true;
      const hay = [
        u.name,
        u.email,
        u.primaryRole,
        u.canonicalTitle,
        u.chapterName,
        u.location,
        u.cohortName,
        ...u.roles,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query, roleFilter]);

  function patchUser(id: string, patch: Partial<AdminUserRow>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  function rememberLocation(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLocations((prev) => {
      if (prev.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed].sort((a, b) => a.localeCompare(b));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <DataTableShell
        className="shadow-[0_1px_2px_rgba(15,7,36,0.04)]"
        header={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-[17px] font-bold tracking-[-0.01em] text-ink">
                  Everyone
                </h2>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  {filtered.length === users.length
                    ? `${users.length} people · edit any field in the row`
                    : `Showing ${filtered.length} of ${users.length}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInputV2
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  wrapClassName="min-w-[15rem] sm:min-w-[18rem]"
                />
                <select
                  className="h-9.5 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                >
                  <option value="ALL">All roles</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {formatAccessLabel(role)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowCohortCreate((v) => !v)}
                >
                  {showCohortCreate ? "Done" : "Add cohort"}
                </Button>
              </div>
            </div>
            {showCohortCreate ? (
              <div className="rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2.5">
                <NewCohortField
                  onCreated={(cohort) => {
                    setCohorts((prev) =>
                      [...prev, cohort].sort((a, b) => a.name.localeCompare(b.name))
                    );
                    setToast({ tone: "success", text: `Created “${cohort.name}”.` });
                    setShowCohortCreate(false);
                  }}
                  onError={(text) => setToast({ tone: "danger", text })}
                />
              </div>
            ) : null}
          </div>
        }
      >
        <datalist id={locationListId}>
          {locations.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
        {filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyStateV2
              title="No one matches"
              body="Try another search or clear the role filter."
            />
          </div>
        ) : (
          <TableV2>
            <thead>
              <tr className="bg-surface-soft/60">
                <TableHeadCell className="sticky left-0 z-[1] bg-surface-soft/95 backdrop-blur-sm">
                  Person
                </TableHeadCell>
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell>Grade</TableHeadCell>
                <TableHeadCell>Cohort</TableHeadCell>
                <TableHeadCell>Chapter</TableHeadCell>
                <TableHeadCell>Location</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  chapters={chapters}
                  cohorts={cohorts}
                  locationListId={locationListId}
                  onPatch={patchUser}
                  onRememberLocation={rememberLocation}
                  onSaved={(text) => setToast({ tone: "success", text })}
                  onError={(text) => setToast({ tone: "danger", text })}
                />
              ))}
            </tbody>
          </TableV2>
        )}
      </DataTableShell>

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

function UserRow({
  user,
  chapters,
  cohorts,
  locationListId,
  onPatch,
  onRememberLocation,
  onSaved,
  onError,
}: {
  user: AdminUserRow;
  chapters: ChapterOption[];
  cohorts: CohortOption[];
  locationListId: string;
  onPatch: (id: string, patch: Partial<AdminUserRow>) => void;
  onRememberLocation: (value: string) => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const archived = Boolean(user.archivedAt);
  const [locationDraft, setLocationDraft] = useState(user.location ?? "");

  function save(
    patch: {
      primaryRole?: string;
      chapterId?: string;
      cohortId?: string;
      location?: string | null;
    },
    optimistic: Partial<AdminUserRow>,
    okMessage: string
  ) {
    const prev: Partial<AdminUserRow> = {
      primaryRole: user.primaryRole,
      roles: user.roles,
      canonicalTitle: user.canonicalTitle,
      ladder: user.ladder,
      internalLevel: user.internalLevel,
      chapterId: user.chapterId,
      chapterName: user.chapterName,
      location: user.location,
      cohortId: user.cohortId,
      cohortName: user.cohortName,
    };
    onPatch(user.id, optimistic);
    startTransition(async () => {
      try {
        await updateAdminUserRow({ userId: user.id, ...patch });
        onSaved(okMessage);
      } catch (error) {
        onPatch(user.id, prev);
        if (patch.location !== undefined) {
          setLocationDraft(prev.location ?? "");
        }
        onError(error instanceof Error ? error.message : "Could not save.");
      }
    });
  }

  function saveGrade(value: string) {
    const prev = {
      canonicalTitle: user.canonicalTitle,
      ladder: user.ladder,
      internalLevel: user.internalLevel,
    };
    const meta =
      value && value !== CLEAR
        ? TITLE_AUTHORITY[value as keyof typeof TITLE_AUTHORITY]
        : null;
    onPatch(user.id, {
      canonicalTitle: value && value !== CLEAR ? value : null,
      ladder: meta?.ladder ?? null,
      internalLevel: meta?.internalLevel ?? null,
    });
    startTransition(async () => {
      try {
        await setUserGroup({
          userId: user.id,
          title: value && value !== CLEAR ? value : CLEAR,
        });
        onSaved(
          value && value !== CLEAR
            ? `${user.name} → ${value}`
            : `${user.name}: no grade`
        );
      } catch (error) {
        onPatch(user.id, prev);
        onError(error instanceof Error ? error.message : "Could not save grade.");
      }
    });
  }

  function commitLocation() {
    const next = locationDraft.trim();
    const current = (user.location ?? "").trim();
    if (next === current) return;
    if (next) onRememberLocation(next);
    save(
      { location: next || null },
      { location: next || null },
      next ? `${user.name} → ${next}` : `${user.name}: no location`
    );
  }

  return (
    <tr
      className={[
        "group border-b border-line-soft/80 transition-colors last:border-b-0 hover:bg-brand-50/40",
        archived ? "opacity-55" : "",
        pending ? "bg-surface-soft/80" : "",
      ].join(" ")}
    >
      <TableCell className="sticky left-0 z-[1] bg-surface group-hover:bg-[#f7f3fc]">
        <div className="flex min-w-[12rem] items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-[13.5px] font-semibold text-ink">
              {user.name}
              {archived ? (
                <span className="ml-2 rounded-full bg-surface-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Archived
                </span>
              ) : null}
            </p>
            <p className="m-0 truncate text-[12px] text-ink-muted">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <select
          className={selectClass}
          value={user.primaryRole}
          disabled={pending || archived}
          aria-label={`Role for ${user.name}`}
          onChange={(e) => {
            const primaryRole = e.target.value;
            save(
              { primaryRole },
              {
                primaryRole,
                roles: Array.from(
                  new Set([
                    primaryRole,
                    ...user.roles.filter((r) => r !== user.primaryRole),
                  ])
                ),
              },
              `${user.name} → ${formatAccessLabel(primaryRole)}`
            );
          }}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {formatAccessLabel(role)}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <select
          className={selectClass}
          value={user.canonicalTitle ?? ""}
          disabled={pending || archived}
          aria-label={`Grade for ${user.name}`}
          onChange={(e) => saveGrade(e.target.value || CLEAR)}
        >
          <option value="">No grade</option>
          {TITLE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.titles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <select
          className={selectClass}
          value={user.cohortId ?? NONE}
          disabled={pending || archived}
          aria-label={`Cohort for ${user.name}`}
          onChange={(e) => {
            const value = e.target.value;
            const cohort = cohorts.find((c) => c.id === value) ?? null;
            save(
              { cohortId: value },
              {
                cohortId: value === NONE ? null : value,
                cohortName: value === NONE ? null : cohort?.name ?? null,
              },
              value === NONE
                ? `${user.name}: no cohort`
                : `${user.name} → ${cohort?.name ?? "cohort"}`
            );
          }}
        >
          <option value={NONE}>No cohort</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <select
          className={selectClass}
          value={user.chapterId ?? CLEAR}
          disabled={pending || archived}
          aria-label={`Chapter for ${user.name}`}
          onChange={(e) => {
            const value = e.target.value;
            const chapter = chapters.find((c) => c.id === value) ?? null;
            save(
              { chapterId: value },
              {
                chapterId: value === CLEAR ? null : value,
                chapterName: value === CLEAR ? null : chapter?.name ?? null,
              },
              value === CLEAR
                ? `${user.name}: no chapter`
                : `${user.name} → ${chapter?.name ?? "chapter"}`
            );
          }}
        >
          <option value={CLEAR}>No chapter</option>
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.name}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <input
          className={locationInputClass}
          list={locationListId}
          value={locationDraft}
          disabled={pending || archived}
          placeholder="City or area"
          aria-label={`Location for ${user.name}`}
          onChange={(e) => setLocationDraft(e.target.value)}
          onBlur={commitLocation}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </TableCell>
    </tr>
  );
}

function NewCohortField({
  onCreated,
  onError,
}: {
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
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="h-9 min-w-[12rem] flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-brand-500"
        value={name}
        placeholder="New cohort name — e.g. Spring 2026"
        aria-label="New cohort name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            create();
          }
        }}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        loading={pending}
        disabled={!name.trim()}
        onClick={create}
      >
        Create
      </Button>
    </div>
  );
}
