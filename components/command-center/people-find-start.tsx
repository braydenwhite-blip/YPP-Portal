"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RoleType } from "@prisma/client";

import { CcIcon } from "@/components/command-center/icons";
import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import { createUser } from "@/lib/admin-actions";

export type PersonFindOption = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  affiliation: string | null;
  profileHref: string;
  actionHref: string;
  meetingHref: string;
};

export type ChapterOption = { id: string; name: string };

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");
const selectClass = inputClass;

const QUICK_ROLES: RoleType[] = [
  RoleType.STUDENT,
  RoleType.INSTRUCTOR,
  RoleType.MENTOR,
  RoleType.STAFF,
  RoleType.ADMIN,
];

function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
          {hint ? <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Calm OS people finder + optional add-person form — `/people/find`. */
export function PeopleFindStart({
  people,
  chapters,
  canAddPerson,
  cancelHref = "/people",
  initialId,
}: {
  people: PersonFindOption[];
  chapters: ChapterOption[];
  canAddPerson: boolean;
  cancelHref?: string;
  initialId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"find" | "add">("find");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialId && people.some((p) => p.id === initialId) ? initialId : null
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [primaryRole, setPrimaryRole] = useState<RoleType>(RoleType.STUDENT);
  const [chapterId, setChapterId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people.slice(0, 40);
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.affiliation?.toLowerCase().includes(q) ?? false) ||
          p.roleLabel.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [people, query]);

  const selected = people.find((p) => p.id === selectedId) ?? null;

  function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email, and a temporary password are required.");
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("email", email.trim());
        fd.set("password", password);
        fd.set("primaryRole", primaryRole);
        if (chapterId) fd.set("chapterId", chapterId);

        const result = await createUser(fd);
        router.push(result.id ? `/people/${result.id}` : "/people");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add person. Try again.");
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card">
      <div className="flex border-b border-line-soft bg-surface/90 px-4 py-2 sm:px-6">
        <button
          type="button"
          onClick={() => setMode("find")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            mode === "find" ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-brand-50 hover:text-ink"
          )}
        >
          Find someone
        </button>
        {canAddPerson ? (
          <button
            type="button"
            onClick={() => setMode("add")}
            className={cn(
              "ml-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              mode === "add" ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-brand-50 hover:text-ink"
            )}
          >
            Add someone new
          </button>
        ) : null}
      </div>

      {mode === "find" ? (
        <>
          <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
            <FormSection step={1} title="Who are you looking for?" hint="Search by name, email, or role.">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className={inputClass}
                autoFocus
                aria-label="Search people"
              />
              <div className="flex flex-col gap-2">
                {filtered.length === 0 ? (
                  <p className="m-0 text-[13px] text-ink-muted">
                    No matches. {canAddPerson ? "Try Add someone new, or broaden your search." : "Try another search."}
                  </p>
                ) : (
                  filtered.map((person) => {
                    const active = selectedId === person.id;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setSelectedId(person.id)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                          active
                            ? "border-brand-400 bg-brand-50/80 shadow-sm"
                            : "border-line-soft bg-surface hover:border-brand-300 hover:bg-surface-soft"
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-bold text-ink">{person.name}</span>
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                            {person.roleLabel}
                          </span>
                        </span>
                        <span className="text-[12.5px] text-ink-muted">{person.email}</span>
                        {person.affiliation ? (
                          <span className="text-[12.5px] text-ink-muted">{person.affiliation}</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </FormSection>

            {selected ? (
              <>
                <div className="h-px bg-line-soft/80" aria-hidden />
                <FormSection step={2} title="What do you need?" hint="Jump straight to their profile or start work.">
                  <div className="grid gap-2">
                    <ButtonLink
                      href={selected.profileHref}
                      variant="primary"
                      size="md"
                      className="w-full justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CcIcon name="user" size={16} />
                        Open profile
                      </span>
                      <span aria-hidden>→</span>
                    </ButtonLink>
                    <ButtonLink
                      href={selected.actionHref}
                      variant="secondary"
                      size="md"
                      className="w-full justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CcIcon name="bolt" size={16} />
                        Add action for {selected.name.split(" ")[0]}
                      </span>
                      <span aria-hidden>→</span>
                    </ButtonLink>
                    <ButtonLink
                      href={selected.meetingHref}
                      variant="secondary"
                      size="md"
                      className="w-full justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CcIcon name="calendar" size={16} />
                        Schedule a meeting
                      </span>
                      <span aria-hidden>→</span>
                    </ButtonLink>
                  </div>
                </FormSection>
              </>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
            <p className="m-0 text-[12.5px] text-ink-muted">Pick someone, then open their record or add work.</p>
            <ButtonLink href={cancelHref} variant="ghost" size="md">
              Cancel
            </ButtonLink>
          </footer>
        </>
      ) : (
        <form onSubmit={handleAddPerson}>
          <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
            {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}

            <FormSection step={1} title="Who is this?" hint="Name and email for their portal account.">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className={titleInputClass}
                required
                autoFocus
                aria-label="Name"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className={inputClass}
                required
                aria-label="Email"
              />
            </FormSection>

            <div className="h-px bg-line-soft/80" aria-hidden />

            <FormSection step={2} title="Role & access" hint="They can change password on first login.">
              <select
                value={primaryRole}
                onChange={(e) => setPrimaryRole(e.target.value as RoleType)}
                className={selectClass}
                aria-label="Primary role"
              >
                {QUICK_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {chapters.length > 0 ? (
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  className={selectClass}
                  aria-label="Chapter"
                >
                  <option value="">No chapter</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password"
                className={inputClass}
                required
                minLength={8}
                aria-label="Temporary password"
              />
            </FormSection>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
            <p className="m-0 text-[12.5px] text-ink-muted">Creates a portal account — share the temp password securely.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setMode("find")}>
                Back to search
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? "Creating…" : "Add person"}
              </Button>
            </div>
          </footer>
        </form>
      )}
    </div>
  );
}
