"use client";

import { useMemo, useState } from "react";

import { Avatar } from "@/components/command-center/primitives";
import { cn } from "@/components/ui-v2";
import { getUserTitle, type TitleResolvable } from "@/lib/user-title";

export type ActionUserOption = TitleResolvable & {
  id: string;
  name: string | null;
  email: string;
};

function displayName(u: ActionUserOption): string {
  return u.name ?? u.email;
}

/**
 * Searchable user picker for action forms. Multi mode allows any number;
 * single mode enforces exactly one (used for the accountable lead).
 */
export function ActionUserPicker({
  label,
  required,
  single,
  users,
  selected,
  onChange,
  excludeIds = [],
  emptyHint,
  id,
  variant = "legacy",
}: {
  label: React.ReactNode;
  required?: boolean;
  single?: boolean;
  users: ActionUserOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  excludeIds?: string[];
  emptyHint?: string;
  id?: string;
  variant?: "legacy" | "calm";
}) {
  const isCalm = variant === "calm";
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const available = useMemo(
    () => users.filter((u) => !excludeIds.includes(u.id)),
    [users, excludeIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? available.filter((u) => {
          const roleLabel = getUserTitle(u);
          const hay = `${u.name ?? ""} ${u.email} ${roleLabel}`.toLowerCase();
          return hay.includes(q);
        })
      : available;
    return isCalm ? pool.slice(0, 6) : pool;
  }, [available, query, isCalm]);

  const selectedUsers = useMemo(
    () =>
      selected
        .map((userId) => users.find((u) => u.id === userId))
        .filter(Boolean) as ActionUserOption[],
    [selected, users]
  );

  function toggle(userId: string) {
    if (single) {
      onChange(selected.includes(userId) ? [] : [userId]);
      return;
    }
    onChange(
      selected.includes(userId) ? selected.filter((x) => x !== userId) : [...selected, userId]
    );
  }

  const searchId = id ? `${id}-search` : undefined;
  const showCalmList =
    isCalm && (searchFocused || query.trim().length > 0) && available.length > 0;

  const calmInput =
    "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

  if (isCalm) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="text-[14px] font-semibold text-ink" id={id}>
            {label}
            {required ? <span className="text-brand-600"> *</span> : null}
          </label>
          {selectedUsers.length > 0 ? (
            <span className="text-[12px] text-ink-muted">First person is the lead</span>
          ) : null}
        </div>

        {selectedUsers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((u, index) => (
              <span
                key={u.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-line-soft bg-surface py-1 pl-1 pr-2 shadow-sm"
              >
                <Avatar name={displayName(u)} size="sm" />
                <span className="min-w-0 truncate text-[13px] font-medium text-ink">
                  {displayName(u)}
                </span>
                {index === 0 ? (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                    Lead
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  aria-label={`Remove ${displayName(u)}`}
                  className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">Search and add everyone who should see this.</p>
        )}

        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
          placeholder="Search by name or email…"
          aria-label={`${typeof label === "string" ? label : "User"} search`}
          className={calmInput}
        />

        {showCalmList ? (
          <ul
            className="m-0 flex max-h-52 list-none flex-col gap-1 overflow-y-auto rounded-[14px] border border-line-soft bg-surface p-1.5 shadow-card"
            role="group"
            aria-labelledby={id}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-ink-muted">
                {query.trim() ? `No matches for “${query.trim()}”.` : (emptyHint ?? "No users available.")}
              </li>
            ) : (
              filtered.map((u) => {
                const checked = selected.includes(u.id);
                const roleLabel = getUserTitle(u);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors",
                        checked ? "bg-brand-50 text-brand-900" : "hover:bg-surface-soft"
                      )}
                    >
                      <Avatar name={displayName(u)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {displayName(u)}
                        </span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {u.name ? u.email : roleLabel}
                          {u.name ? ` · ${roleLabel}` : ""}
                        </span>
                      </span>
                      {checked ? (
                        <span className="shrink-0 text-[12px] font-bold text-brand-700">Added</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    );
  }

  function userChipLabel(u: ActionUserOption): string {
    const title = getUserTitle(u);
    if (u.name) return `${u.name} · ${title}`;
    return `${u.email} · ${title}`;
  }

  return (
    <div className="ps-field">
      <span className="ps-label" id={id}>
        {label}
        {required ? (
          <span aria-hidden className="ps-required">
            *
          </span>
        ) : null}
      </span>

      {selectedUsers.length > 0 ? (
        <div className="ps-picker-chips">
          {selectedUsers.map((u) => (
            <span key={u.id} className="ps-picker-chip">
              {userChipLabel(u)}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.name ?? u.email}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, or role…"
        aria-label={`${typeof label === "string" ? label : "User"} search`}
        className="ps-input"
      />

      <div
        className="ps-picker-list"
        role="group"
        aria-labelledby={id}
        aria-label={typeof label === "string" ? label : "User options"}
      >
        {available.length === 0 ? (
          <span className="ps-picker-empty">{emptyHint ?? "No users available."}</span>
        ) : null}
        {available.length > 0 && filtered.length === 0 ? (
          <span className="ps-picker-empty">No matches for “{query}”.</span>
        ) : null}
        {filtered.map((u) => {
          const checked = selected.includes(u.id);
          const roleLabel = getUserTitle(u);
          return (
            <label key={u.id} className={`ps-picker-option${checked ? " is-selected" : ""}`}>
              <input
                type={single ? "radio" : "checkbox"}
                checked={checked}
                onChange={() => toggle(u.id)}
              />
              <span style={{ display: "flex", flexWrap: "wrap", gap: "0.35em", alignItems: "baseline" }}>
                <span>{u.name ?? u.email}</span>
                {u.name ? (
                  <span style={{ color: "var(--muted)", fontSize: "0.92em" }}>{u.email}</span>
                ) : null}
                <span
                  style={{
                    color: "var(--ps-ink-soft, var(--muted))",
                    fontSize: "0.88em",
                    fontWeight: 600,
                  }}
                >
                  {roleLabel}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
