"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useEntity360 } from "@/components/operations/entity-360-context";
import { cn, EmptyStateV2 } from "@/components/ui-v2";
import { suggestionsForTier } from "@/lib/help-agent/suggestions";
import type {
  HelpAgentResult,
  HelpAgentSearchResponse,
  HelpAgentSuggestion,
} from "@/lib/help-agent/types";
import type { Entity360Type } from "@/lib/operations/entity-360";

/**
 * YPP Help Agent — the shared search experience behind both the global ⌘K
 * palette and the /help-agent page. Deterministic: every keystroke is one
 * debounced fetch to /api/search (live entity queries), never a model call.
 *
 * Preview-first: selecting an entity result opens its Entity 360 drawer in
 * place; ⌘/Ctrl+Enter (or the provider being absent) navigates to the full
 * page instead.
 */

const TYPE_ICON: Record<Entity360Type, string> = {
  person: "👤",
  class: "📚",
  partner: "🤝",
  initiative: "🚩",
  meeting: "📅",
  action: "✅",
  mentorship: "🔄",
  applicant: "📋",
};

type Selectable =
  | { kind: "result"; result: HelpAgentResult }
  | { kind: "suggestion"; suggestion: HelpAgentSuggestion };

export function HelpAgentSearch({
  officerTier,
  adminTier,
  variant,
  onDone,
  autoFocus = true,
}: {
  officerTier: boolean;
  adminTier?: boolean;
  variant: "palette" | "page";
  /** Called after any selection (palette closes itself through this). */
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const entity360 = useEntity360();

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<HelpAgentSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => suggestionsForTier(officerTier ? "OFFICER" : "MEMBER", { admin: adminTier }),
    [adminTier, officerTier]
  );

  // Debounced fetch; empty query loads recents once.
  useEffect(() => {
    const controller = new AbortController();
    const trimmed = query.trim();
    setLoading(true);
    const timer = window.setTimeout(
      () => {
        fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) throw new Error("Search failed");
            return (await res.json()) as HelpAgentSearchResponse;
          })
          .then((data) => {
            setResponse(data);
            setSelected(0);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if ((err as Error).name !== "AbortError") setLoading(false);
          });
      },
      trimmed ? 150 : 0
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const groups = useMemo(
    () => (hasQuery ? (response?.groups ?? []) : []),
    [hasQuery, response]
  );
  const recents = useMemo(
    () => (!hasQuery ? (response?.recents ?? []) : []),
    [hasQuery, response]
  );

  // The flat keyboard-selectable list, in visual order.
  const selectables = useMemo<Selectable[]>(() => {
    if (hasQuery) {
      return groups.flatMap((g) =>
        g.items.map((result) => ({ kind: "result" as const, result }))
      );
    }
    return [
      ...suggestions.map((suggestion) => ({
        kind: "suggestion" as const,
        suggestion,
      })),
      ...recents.map((result) => ({ kind: "result" as const, result })),
    ];
  }, [hasQuery, groups, suggestions, recents]);

  const activate = useCallback(
    (item: Selectable, forceNavigate: boolean) => {
      if (item.kind === "suggestion") {
        router.push(item.suggestion.href);
        onDone?.();
        return;
      }
      const { result } = item;
      if (!forceNavigate && entity360) {
        onDone?.();
        entity360.openEntity(result.type, result.id);
        return;
      }
      if (result.href) {
        router.push(result.href);
        onDone?.();
      }
    },
    [entity360, onDone, router]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((s) => Math.min(s + 1, selectables.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (event.key === "Enter" && selectables.length > 0) {
        event.preventDefault();
        activate(
          selectables[Math.min(selected, selectables.length - 1)],
          event.metaKey || event.ctrlKey
        );
      }
    },
    [activate, selectables, selected]
  );

  // Keep the selected row in view while arrowing.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selected}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  let flatIndex = -1;
  const nextIndex = () => {
    flatIndex += 1;
    return flatIndex;
  };

  const isPage = variant === "page";

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      {/* Input */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-line-soft",
          isPage ? "px-5 py-4" : "px-4 py-3"
        )}
      >
        <span aria-hidden className="text-[16px] text-ink-muted">
          ⌕
        </span>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, partners, classes, meetings, actions…"
          aria-label="Search YPP"
          className={cn(
            "w-full bg-transparent text-ink outline-none placeholder:text-ink-muted/60",
            isPage ? "text-[17px]" : "text-[15px]"
          )}
        />
        {loading ? (
          <span
            aria-hidden
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
          />
        ) : null}
      </div>

      {/* Results / suggestions */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {hasQuery ? (
          groups.length === 0 && !loading ? (
            <EmptyStateV2
              tone="editorial"
              title={`No matches for “${query.trim()}”`}
              body="Try a name, an email, a partner, a class, or a meeting title."
            />
          ) : (
            groups.map((group) => (
              <section key={group.type} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {group.label}
                </p>
                {group.items.map((result) => {
                  const index = nextIndex();
                  return (
                    <ResultRow
                      key={`${result.type}:${result.id}`}
                      result={result}
                      index={index}
                      active={index === selected}
                      onHover={() => setSelected(index)}
                      onActivate={(force) =>
                        activate({ kind: "result", result }, force)
                      }
                    />
                  );
                })}
              </section>
            ))
          )
        ) : (
          <>
            <section className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Suggested
              </p>
              {suggestions.map((suggestion) => {
                const index = nextIndex();
                return (
                  <button
                    key={suggestion.label}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => activate({ kind: "suggestion", suggestion }, false)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left",
                      index === selected ? "bg-brand-50" : "hover:bg-brand-50/60"
                    )}
                  >
                    <span aria-hidden className="w-5 text-center text-[14px]">
                      {suggestion.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {suggestion.label}
                      </span>
                      <span className="block truncate text-[12px] text-ink-muted">
                        {suggestion.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>
            {recents.length > 0 ? (
              <section className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  Recently viewed
                </p>
                {recents.map((result) => {
                  const index = nextIndex();
                  return (
                    <ResultRow
                      key={`${result.type}:${result.id}`}
                      result={result}
                      index={index}
                      active={index === selected}
                      onHover={() => setSelected(index)}
                      onActivate={(force) =>
                        activate({ kind: "result", result }, force)
                      }
                    />
                  );
                })}
              </section>
            ) : null}
          </>
        )}
      </div>

      {/* Footer hints */}
      <div className="flex items-center gap-4 border-t border-line-soft bg-surface-soft px-4 py-2 text-[11px] font-medium text-ink-muted">
        <span>
          <kbd className="font-sans font-bold">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-sans font-bold">↵</kbd> open preview
        </span>
        <span>
          <kbd className="font-sans font-bold">⌘↵</kbd> open full page
        </span>
        {variant === "palette" ? (
          <span className="ml-auto">
            <kbd className="font-sans font-bold">esc</kbd> close
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ResultRow({
  result,
  index,
  active,
  onHover,
  onActivate,
}: {
  result: HelpAgentResult;
  index: number;
  active: boolean;
  onHover: () => void;
  onActivate: (forceNavigate: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-index={index}
      onMouseEnter={onHover}
      onClick={(event) => onActivate(event.metaKey || event.ctrlKey)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left",
        active ? "bg-brand-50" : "hover:bg-brand-50/60"
      )}
    >
      <span aria-hidden className="w-5 text-center text-[14px]">
        {TYPE_ICON[result.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">
          {result.title}
        </span>
        {result.subtitle ? (
          <span className="block truncate text-[12px] text-ink-muted">
            {result.subtitle}
          </span>
        ) : null}
      </span>
      {active ? (
        <span aria-hidden className="shrink-0 text-[11px] font-semibold text-brand-600">
          open ↵
        </span>
      ) : null}
    </button>
  );
}
