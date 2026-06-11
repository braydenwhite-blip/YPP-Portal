"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QuickFindEntry } from "@/lib/operations/data-360-queries";
import { rankQuickFind } from "@/lib/operations/quick-find";

import { EntityLink } from "./entity-link";

/**
 * Data 360 — Quick Find. A client-side filter over everything the page loaded
 * (people, classes, partners, initiatives, meetings, work items): typing
 * "Beth El" surfaces the partner plus its classes, meetings, and open work at
 * once, and picking a result opens its 360 panel in place. Deliberately not a
 * search engine — one index, zero requests, instant.
 */

export function QuickFind({ entries }: { entries: QuickFindEntry[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => rankQuickFind(entries, query), [entries, query]);

  // Close the results panel when clicking anywhere else.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 440, flex: "1 1 280px" }}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Quick find — people, classes, partners, meetings, work…"
        aria-label="Quick find across Data 360"
        style={{
          width: "100%",
          padding: "9px 14px",
          fontSize: 13,
          border: "1px solid var(--border, rgba(107,33,200,0.15))",
          borderRadius: 999,
          background: "var(--surface, #fff)",
          boxShadow: "var(--shadow-xs, 0 1px 3px rgba(15,23,42,0.06))",
        }}
      />
      {open && query.trim() ? (
        <div
          role="listbox"
          aria-label="Quick find results"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, rgba(107,33,200,0.15))",
            borderRadius: 14,
            boxShadow: "var(--shadow-md, 0 6px 24px rgba(59,15,110,0.15))",
            padding: 6,
            display: "grid",
            gap: 2,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {results.length === 0 ? (
            <p style={{ margin: 0, padding: "10px 12px", fontSize: 12.5, color: "var(--muted)" }}>
              Nothing loaded on this page matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((r) => (
              <EntityLink
                key={r.id}
                type={r.entityType ?? "action"}
                id={r.entityType ? r.entityId : null}
                href={r.href}
                className="cc-focusable"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  color: "inherit",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>
                    {r.label}
                  </span>
                  {r.sub ? (
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.sub}</span>
                  ) : null}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "var(--ypp-purple-600, #6b21c8)",
                  }}
                >
                  {r.typeLabel}
                </span>
              </EntityLink>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
