"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { RoleType } from "@prisma/client";

import {
  Button,
  EmptyStateV2,
  ModalFooterV2,
  ModalV2,
  SearchInputV2,
  ToastV2,
} from "@/components/ui-v2";
import {
  createCohort,
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
  phone: string | null;
  title: string | null;
  primaryRole: string;
  roles: string[];
  canonicalTitle: string | null;
  ladder: string | null;
  internalLevel: number | null;
  chapterId: string | null;
  chapterName: string | null;
  location: string | null;
  school: string | null;
  schoolYear: string | null;
  schoolGrade: number | null;
  dateOfBirth: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  graduationYear: number | null;
  college: string | null;
  major: string | null;
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

const fieldClass =
  "mt-1.5 w-full rounded-[9px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-brand-400 disabled:opacity-55";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

type PersonFormKind =
  | "student" // K–8
  | "highSchool" // staff, applicants, instructors, CPs, officers
  | "parent"
  | "board"; // post–high school

function personFormKind(
  role: string,
  orgTitle: string,
  roles: string[] = []
): PersonFormKind {
  const title = orgTitle.trim().toLowerCase();
  // Admin covers Board (post-HS) and Officers (still HS) — title decides.
  if (title === "board member") return "board";
  // Mentor-only accounts are graduated / post-HS (same shape as board).
  const roleSet = new Set((roles.length ? roles : [role]).map((r) => r.toUpperCase()));
  if (roleSet.size === 1 && roleSet.has("MENTOR")) return "board";
  if (role === "STUDENT") return "student";
  if (role === "PARENT") return "parent";
  // Staff, applicants, instructors, CPs, hiring chairs, officers…
  return "highSchool";
}

function formCopy(kind: PersonFormKind): { title: string; blurb: string } {
  switch (kind) {
    case "student":
      return {
        title: "Edit student",
        blurb: "K–8 student profile — grade and family contact.",
      };
    case "highSchool":
      return {
        title: "Edit person",
        blurb: "High-school profile — grad year and placement.",
      };
    case "parent":
      return {
        title: "Edit parent",
        blurb: "Parent contact and chapter — no school fields.",
      };
    case "board":
      return {
        title: "Edit person",
        blurb: "Post–high school profile — access and optional college.",
      };
  }
}

/** List row: school year for K–8 + HS roles; never for board/parents. */
function showsHighSchoolFields(user: AdminUserRow) {
  const kind = personFormKind(
    user.primaryRole,
    user.canonicalTitle ?? "",
    user.roles
  );
  return kind === "student" || kind === "highSchool";
}

function summaryLine(user: AdminUserRow) {
  const bits = [
    formatAccessLabel(user.primaryRole),
    user.canonicalTitle,
    showsHighSchoolFields(user) ? user.schoolYear : null,
    user.graduationYear ? `Class of ${user.graduationYear}` : null,
    user.chapterName,
    user.location,
  ].filter(Boolean);
  return bits.join(" · ");
}

/** Spring year current seniors graduate (Aug+ → next calendar year). */
function seniorGradSpringYear(now = new Date()) {
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
}

function gradeToClassYear(grade: number, now = new Date()) {
  return seniorGradSpringYear(now) + (12 - grade);
}

function formatSchoolYearLabel(
  grade: number | null | undefined,
  mode: "k8" | "hs" = "hs"
) {
  if (grade == null || !Number.isFinite(grade)) return null;
  const n = Math.trunc(grade);
  if (mode === "hs" || n >= 9) {
    return `Class of ${gradeToClassYear(n)}`;
  }
  if (n === 0) return "Kindergarten";
  if (n < 1 || n > 12) return `Grade ${n}`;
  const suffix =
    n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} grade`;
}

/** Grade values stored on profile: students K–8; HS roles 9–12. */
function schoolYearOptions(mode: "k8" | "hs"): number[] {
  if (mode === "k8") return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return [9, 10, 11, 12];
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-[13px] font-semibold text-ink">
      {label}
      {children}
      {hint ? (
        <span className="mt-1 block text-[11.5px] font-normal text-ink-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.name,
        u.email,
        u.phone,
        u.title,
        u.primaryRole,
        u.canonicalTitle,
        u.chapterName,
        u.location,
        u.school,
        u.schoolYear,
        u.graduationYear ? String(u.graduationYear) : null,
        u.college,
        u.cohortName,
        ...u.roles,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const selected = selectedId
    ? users.find((u) => u.id === selectedId) ?? null
    : null;

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
      <div className="rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,7,36,0.04)]">
        <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="m-0 text-[17px] font-bold tracking-[-0.01em] text-ink">
              Everyone
            </h2>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
              {filtered.length === users.length
                ? `${users.length} people · tap someone to edit`
                : `Showing ${filtered.length} of ${users.length}`}
            </p>
          </div>
          <SearchInputV2
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            wrapClassName="w-full sm:min-w-[18rem] sm:max-w-[22rem]"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyStateV2
              title="No one matches"
              body="Try another search."
            />
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-line-soft p-0">
            {filtered.map((user) => {
              const archived = Boolean(user.archivedAt);
              return (
                <li key={user.id} className="m-0 p-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:px-5",
                      "hover:bg-brand-50/50 focus-visible:bg-brand-50/60 focus-visible:outline-none",
                      archived ? "opacity-55" : "",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800"
                    >
                      {initials(user.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">
                        {user.name}
                        {archived ? (
                          <span className="ml-2 rounded-full bg-surface-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                            Archived
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
                        {summaryLine(user) || user.email}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 text-[18px] text-ink-muted/70">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <UserDetailModal
          key={selected.id}
          user={selected}
          chapters={chapters}
          cohorts={cohorts}
          locationOptions={locations}
          onClose={() => setSelectedId(null)}
          onPatch={(patch) => patchUser(selected.id, patch)}
          onCohortCreated={(cohort) => {
            setCohorts((prev) =>
              [...prev, cohort].sort((a, b) => a.name.localeCompare(b.name))
            );
          }}
          onRememberLocation={rememberLocation}
          onSaved={(text) => setToast({ tone: "success", text })}
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

type Draft = {
  name: string;
  email: string;
  phone: string;
  primaryRole: string;
  canonicalTitle: string;
  cohortId: string;
  chapterId: string;
  location: string;
  school: string;
  schoolGrade: string;
  parentEmail: string;
  parentPhone: string;
  graduationYear: string;
  college: string;
  major: string;
};

function draftFromUser(user: AdminUserRow): Draft {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    primaryRole: user.primaryRole,
    canonicalTitle: user.canonicalTitle ?? "",
    cohortId: user.cohortId ?? NONE,
    chapterId: user.chapterId ?? CLEAR,
    location: user.location ?? "",
    school: user.school ?? "",
    schoolGrade: user.schoolGrade != null ? String(user.schoolGrade) : "",
    parentEmail: user.parentEmail ?? "",
    parentPhone: user.parentPhone ?? "",
    graduationYear:
      user.graduationYear != null ? String(user.graduationYear) : "",
    college: user.college ?? "",
    major: user.major ?? "",
  };
}

function UserDetailModal({
  user,
  chapters,
  cohorts,
  locationOptions,
  onClose,
  onPatch,
  onCohortCreated,
  onRememberLocation,
  onSaved,
  onError,
}: {
  user: AdminUserRow;
  chapters: ChapterOption[];
  cohorts: CohortOption[];
  locationOptions: string[];
  onClose: () => void;
  onPatch: (patch: Partial<AdminUserRow>) => void;
  onCohortCreated: (cohort: CohortOption) => void;
  onRememberLocation: (value: string) => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const titleId = useId();
  const locationListId = useId();
  const archived = Boolean(user.archivedAt);
  const [pending, startTransition] = useTransition();
  const [showNewCohort, setShowNewCohort] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromUser(user));

  const kind = personFormKind(
    draft.primaryRole,
    draft.canonicalTitle,
    draft.primaryRole === user.primaryRole
      ? user.roles
      : [draft.primaryRole]
  );
  const copy = formCopy(kind);
  const showSchool = kind === "student" || kind === "highSchool";
  const schoolMode: "k8" | "hs" = kind === "student" ? "k8" : "hs";
  const showParentContact = kind === "student";
  const showAlumni = kind === "board";
  // Org title matters for Admin (Board vs Officer) and other leadership roles.
  const showOrgTitle =
    draft.primaryRole === "ADMIN" ||
    draft.primaryRole === "STAFF" ||
    draft.primaryRole === "HIRING_CHAIR" ||
    draft.primaryRole === "CHAPTER_PRESIDENT" ||
    kind === "board";

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(draftFromUser(user));

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (archived || !dirty) {
      onClose();
      return;
    }

    const name = draft.name.trim();
    const email = draft.email.trim();
    if (!name) {
      onError("Name is required.");
      return;
    }
    if (!email) {
      onError("Email is required.");
      return;
    }

    const nextLocation = draft.location.trim() || null;
    const schoolGrade = draft.schoolGrade
      ? Number.parseInt(draft.schoolGrade, 10)
      : null;
    const graduationYear = draft.graduationYear
      ? Number.parseInt(draft.graduationYear, 10)
      : null;
    const chapter =
      draft.chapterId === CLEAR
        ? null
        : chapters.find((c) => c.id === draft.chapterId) ?? null;
    const cohort =
      draft.cohortId === NONE
        ? null
        : cohorts.find((c) => c.id === draft.cohortId) ?? null;
    const orgTitle = draft.canonicalTitle || CLEAR;
    const gradeMeta =
      orgTitle !== CLEAR
        ? TITLE_AUTHORITY[orgTitle as keyof typeof TITLE_AUTHORITY]
        : null;

    const optimistic: Partial<AdminUserRow> = {
      name,
      email,
      phone: draft.phone.trim() || null,
      primaryRole: draft.primaryRole,
      roles: Array.from(
        new Set([
          draft.primaryRole,
          ...user.roles.filter((r) => r !== user.primaryRole),
        ])
      ),
      canonicalTitle: orgTitle === CLEAR ? null : orgTitle,
      ladder: gradeMeta?.ladder ?? null,
      internalLevel: gradeMeta?.internalLevel ?? null,
      chapterId: chapter?.id ?? null,
      chapterName: chapter?.name ?? null,
      cohortId: cohort?.id ?? null,
      cohortName: cohort?.name ?? null,
      location: nextLocation,
      school: showSchool ? draft.school.trim() || null : user.school,
      schoolGrade: showSchool ? schoolGrade : user.schoolGrade,
      schoolYear: showSchool
        ? formatSchoolYearLabel(schoolGrade, schoolMode)
        : user.schoolYear,
      parentEmail: showParentContact
        ? draft.parentEmail.trim() || null
        : user.parentEmail,
      parentPhone: showParentContact
        ? draft.parentPhone.trim() || null
        : user.parentPhone,
      graduationYear: showAlumni
        ? graduationYear != null && Number.isFinite(graduationYear)
          ? graduationYear
          : null
        : user.graduationYear,
      college: showAlumni ? draft.college.trim() || null : user.college,
      major: showAlumni ? draft.major.trim() || null : user.major,
    };

    const prev: AdminUserRow = { ...user };
    onPatch(optimistic);
    if (nextLocation) onRememberLocation(nextLocation);

    startTransition(async () => {
      try {
        await updateAdminUserRow({
          userId: user.id,
          name,
          email,
          phone: draft.phone.trim() || null,
          primaryRole: draft.primaryRole,
          ...(showOrgTitle || draft.canonicalTitle !== (user.canonicalTitle ?? "")
            ? { orgTitle }
            : {}),
          chapterId: draft.chapterId,
          cohortId: draft.cohortId,
          location: nextLocation,
          ...(showSchool
            ? {
                school: draft.school.trim() || null,
                schoolGrade,
              }
            : {}),
          ...(showParentContact
            ? {
                parentEmail: draft.parentEmail.trim() || null,
                parentPhone: draft.parentPhone.trim() || null,
              }
            : {}),
          ...(showAlumni
            ? {
                graduationYear:
                  graduationYear != null && Number.isFinite(graduationYear)
                    ? graduationYear
                    : null,
                college: draft.college.trim() || null,
                major: draft.major.trim() || null,
              }
            : {}),
        });
        onSaved(`Saved ${name}`);
        onClose();
      } catch (error) {
        onPatch(prev);
        onError(error instanceof Error ? error.message : "Could not save.");
      }
    });
  }

  return (
    <ModalV2
      open
      onClose={onClose}
      labelledBy={titleId}
      locked={pending}
      size="lg"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-800"
        >
          {initials(draft.name || user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={titleId}
            className="m-0 truncate text-[20px] font-bold tracking-[-0.01em] text-ink"
          >
            {copy.title}
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{copy.blurb}</p>
          {archived ? (
            <p className="m-0 mt-1 text-[12px] font-medium text-ink-muted">
              Archived — fields are read-only.
            </p>
          ) : null}
        </div>
      </div>

      <Field label="Role">
        <select
          className={fieldClass}
          value={draft.primaryRole}
          disabled={pending || archived}
          onChange={(e) => setField("primaryRole", e.target.value)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {formatAccessLabel(role)}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex max-h-[min(65vh,580px)] flex-col gap-4 overflow-y-auto pr-1">
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
            Identity
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input
                className={fieldClass}
                value={draft.name}
                disabled={pending || archived}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                className={fieldClass}
                type="email"
                value={draft.email}
                disabled={pending || archived}
                onChange={(e) => setField("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={fieldClass}
                value={draft.phone}
                disabled={pending || archived}
                placeholder="Optional"
                onChange={(e) => setField("phone", e.target.value)}
              />
            </Field>
            <Field label="Location" hint="City, State">
              <input
                className={fieldClass}
                list={locationListId}
                value={draft.location}
                disabled={pending || archived}
                placeholder="City or area"
                onChange={(e) => setField("location", e.target.value)}
              />
              <datalist id={locationListId}>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </Field>
          </div>
        </section>

        {showSchool ? (
          <section className="flex flex-col gap-3">
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
              {schoolMode === "k8" ? "School (K–8)" : "School (high school)"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="School">
                <input
                  className={fieldClass}
                  value={draft.school}
                  disabled={pending || archived}
                  onChange={(e) => setField("school", e.target.value)}
                />
              </Field>
              <Field
                label={schoolMode === "k8" ? "Grade" : "Grad year"}
                hint={
                  schoolMode === "k8"
                    ? "K–8 students"
                    : "High-school graduation class"
                }
              >
                <select
                  className={fieldClass}
                  value={draft.schoolGrade}
                  disabled={pending || archived}
                  onChange={(e) => setField("schoolGrade", e.target.value)}
                >
                  <option value="">Not set</option>
                  {schoolYearOptions(schoolMode).map((n) => (
                    <option key={n} value={String(n)}>
                      {formatSchoolYearLabel(n, schoolMode)}
                    </option>
                  ))}
                </select>
              </Field>
              {showParentContact ? (
                <>
                  <Field label="Parent email">
                    <input
                      className={fieldClass}
                      type="email"
                      value={draft.parentEmail}
                      disabled={pending || archived}
                      onChange={(e) => setField("parentEmail", e.target.value)}
                    />
                  </Field>
                  <Field label="Parent phone">
                    <input
                      className={fieldClass}
                      value={draft.parentPhone}
                      disabled={pending || archived}
                      onChange={(e) => setField("parentPhone", e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {showAlumni ? (
          <section className="flex flex-col gap-3">
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
              College
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Graduation year">
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={draft.graduationYear}
                  disabled={pending || archived}
                  placeholder="e.g. 2024"
                  onChange={(e) => setField("graduationYear", e.target.value)}
                />
              </Field>
              <Field label="College">
                <input
                  className={fieldClass}
                  value={draft.college}
                  disabled={pending || archived}
                  onChange={(e) => setField("college", e.target.value)}
                />
              </Field>
              <Field label="Major">
                <input
                  className={fieldClass}
                  value={draft.major}
                  disabled={pending || archived}
                  onChange={(e) => setField("major", e.target.value)}
                />
              </Field>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
            Placement
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {showOrgTitle ? (
              <Field label="Org title">
                <select
                  className={fieldClass}
                  value={draft.canonicalTitle}
                  disabled={pending || archived}
                  onChange={(e) => setField("canonicalTitle", e.target.value)}
                >
                  <option value="">No title</option>
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
              </Field>
            ) : null}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">Cohort</span>
                {!archived ? (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-brand-700 hover:underline"
                    onClick={() => setShowNewCohort((v) => !v)}
                  >
                    {showNewCohort ? "Cancel" : "Add cohort"}
                  </button>
                ) : null}
              </div>
              <select
                className={fieldClass}
                value={draft.cohortId}
                disabled={pending || archived}
                onChange={(e) => setField("cohortId", e.target.value)}
              >
                <option value={NONE}>No cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              {showNewCohort ? (
                <div className="mt-2">
                  <NewCohortField
                    onCreated={(cohort) => {
                      onCohortCreated(cohort);
                      setField("cohortId", cohort.id);
                      setShowNewCohort(false);
                      onSaved(`Created “${cohort.name}”.`);
                    }}
                    onError={onError}
                  />
                </div>
              ) : null}
            </div>
            <Field label="Chapter">
              <select
                className={fieldClass}
                value={draft.chapterId}
                disabled={pending || archived}
                onChange={(e) => setField("chapterId", e.target.value)}
              >
                <option value={CLEAR}>No chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      </div>

      <ModalFooterV2>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={archived || (!dirty && !pending)}
          onClick={save}
        >
          Save
        </Button>
      </ModalFooterV2>
    </ModalV2>
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
        className="h-10 min-w-[12rem] flex-1 rounded-[9px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-brand-500"
        value={name}
        placeholder="New cohort name"
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
