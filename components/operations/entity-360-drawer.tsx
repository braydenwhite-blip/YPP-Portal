"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ProfileDrawerContext } from "@/components/people-strategy/profile-drawer-context";
import { Pill, type PillTone } from "@/components/people-strategy/pills";
import type { Entity360, Entity360Type } from "@/lib/operations/entity-360";

import { Entity360Context } from "./entity-360-context";
import { Entity360Body } from "./entity-360-body";

import "./entity-360.css";

/**
 * The universal Entity 360 drawer.
 *
 * Mounts ONCE in the app shell and exposes `openEntity(type, id)` to every
 * `EntityLink` / `PersonLink` beneath it. Clicking any person, class, partner,
 * initiative, meeting, or action name slides this panel in from the right
 * instead of navigating; the page underneath never unloads, so exploring the
 * connected graph (mentor → mentee → their class → its partner …) is a stack
 * of panels with a Back button, not a trail of page loads.
 *
 * It also provides the legacy `ProfileDrawerContext`, so every existing
 * `PersonLink` in the portal opens the new person panel with zero changes.
 * Deep links / modifier clicks still navigate; the drawer closes on route
 * change and on Escape.
 */

type StackEntry = { type: Entity360Type; id: string };

export function Entity360Provider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const pathname = usePathname();

  const openEntity = useCallback((type: Entity360Type, id: string) => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      // Re-clicking the open entity is a no-op, not a duplicate stack entry.
      if (top && top.type === type && top.id === id) return prev;
      return [...prev, { type, id }];
    });
  }, []);
  const back = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  // Close when the route changes (e.g. following a link out of the drawer).
  useEffect(() => {
    setStack([]);
  }, [pathname]);

  const entityApi = useMemo(() => ({ openEntity }), [openEntity]);
  // Legacy adapter: every existing PersonLink opens the person 360 panel.
  const profileApi = useMemo(
    () => ({ openProfile: (id: string) => openEntity("person", id) }),
    [openEntity]
  );

  const top = stack[stack.length - 1];
  return (
    <Entity360Context.Provider value={entityApi}>
      <ProfileDrawerContext.Provider value={profileApi}>
        {children}
        {top ? (
          // Deliberately un-keyed: the panel stays mounted while the stack
          // navigates, so the slide-in plays once and Back/forward swap
          // content (with the skeleton) instead of replaying the animation.
          <Entity360Panel
            type={top.type}
            id={top.id}
            canGoBack={stack.length > 1}
            onBack={back}
            onClose={close}
          />
        ) : null}
      </ProfileDrawerContext.Provider>
    </Entity360Context.Provider>
  );
}

const STATUS_TONE: Record<string, PillTone> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  overdue: "overdue",
  purple: "purple",
};

function Entity360Panel({
  type,
  id,
  canGoBack,
  onBack,
  onClose,
}: {
  type: Entity360Type;
  id: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [entity, setEntity] = useState<Entity360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Move keyboard focus into the dialog when it opens (screen readers + Esc).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    setEntity(null);
    setError(null);
    fetch(`/api/entity-360/${type}/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "This record isn't available."
              : "Couldn't load this record."
          );
        }
        return (await res.json()) as Entity360;
      })
      .then((data) => {
        if (active) setEntity(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [type, id]);

  // Close on Escape (back first when stacked, mirroring browser instincts).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (canGoBack) onBack();
      else onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [canGoBack, onBack, onClose]);

  return (
    <>
      <div className="e360-backdrop" onClick={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="e360-panel"
        role="dialog"
        aria-modal="true"
        aria-label={entity ? `${entity.typeLabel}: ${entity.title}` : "Details"}
        style={{ outline: "none" }}
      >
        <header className="e360-header">
          <div className="e360-header-top">
            {canGoBack ? (
              <button type="button" className="e360-back-button" onClick={onBack}>
                ← Back
              </button>
            ) : null}
            <span className="e360-type-label">{entity?.typeLabel ?? ""}</span>
            <div className="e360-header-buttons">
              {entity?.pageHref ? (
                <Link
                  href={entity.pageHref}
                  className="e360-icon-button"
                  title="Open full page"
                  aria-label="Open full page"
                >
                  ↗
                </Link>
              ) : null}
              <button
                type="button"
                className="e360-icon-button"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="e360-identity">
            <span className="e360-avatar" aria-hidden="true">
              {entity?.avatarUrl ? (
                <img src={entity.avatarUrl} alt="" />
              ) : (
                (entity?.initials ?? "…")
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="e360-name">{entity?.title ?? "Loading…"}</h2>
              {entity?.subtitle ? <p className="e360-subtitle">{entity.subtitle}</p> : null}
            </div>
          </div>

          {entity && (entity.status || entity.meta) ? (
            <div className="e360-header-meta">
              {entity.status ? (
                <Pill tone={STATUS_TONE[entity.status.tone] ?? "neutral"}>
                  {entity.status.label}
                </Pill>
              ) : null}
              {entity.meta ? <span>{entity.meta}</span> : null}
            </div>
          ) : null}
        </header>

        {error ? (
          <p className="e360-error">{error}</p>
        ) : !entity ? (
          <div className="e360-body" aria-busy="true" aria-label="Loading">
            <div className="e360-skeleton" style={{ height: 64 }} />
            <div className="e360-skeleton" style={{ height: 96 }} />
            <div className="e360-skeleton" style={{ height: 44 }} />
            <div className="e360-skeleton" style={{ height: 120 }} />
          </div>
        ) : (
          <Entity360Body entity={entity} />
        )}

        {entity?.footnote ? <footer className="e360-footer">{entity.footnote}</footer> : null}
      </aside>
    </>
  );
}
