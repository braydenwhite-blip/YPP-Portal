"use client";

import { useMemo, useState } from "react";

import { getUserTitle, type TitleResolvable } from "@/lib/user-title";

export type ActionUserOption = TitleResolvable & {
  id: string;
  name: string | null;
  email: string;
};

function userChipLabel(u: ActionUserOption): string {
  const title = getUserTitle(u);
  if (u.name) return `${u.name} · ${title}`;
  return `${u.email} · ${title}`;
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
}) {
  const [query, setQuery] = useState("");

  const available = useMemo(
    () => users.filter((u) => !excludeIds.includes(u.id)),
    [users, excludeIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) => {
      const roleLabel = getUserTitle(u);
      const hay = `${u.name ?? ""} ${u.email} ${roleLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [available, query]);

  const selectedUsers = useMemo(
    () => selected.map((userId) => users.find((u) => u.id === userId)).filter(Boolean) as ActionUserOption[],
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
            <label
              key={u.id}
              className={`ps-picker-option${checked ? " is-selected" : ""}`}
            >
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
