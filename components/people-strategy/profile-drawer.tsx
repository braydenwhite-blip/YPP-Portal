"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import KanbanDetailPanel from "@/components/kanban/kanban-detail-panel";
import { ProfileBody, activeLabel } from "@/components/people-strategy/profile-body";
import type { PublicProfile } from "@/lib/people-strategy/public-profile";
import { ProfileDrawerContext } from "./profile-drawer-context";

/**
 * Mounts once (in the app shell) and exposes `openProfile(id)` to every
 * `PersonLink` underneath it. Clicking a name opens this slide-in drawer in
 * place instead of navigating; deep links / new-tab clicks still go to the
 * full `/people/[id]` page. The drawer auto-closes on route change.
 */
export function ProfileDrawerProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const pathname = usePathname();
  const openProfile = useCallback((id: string) => setOpenId(id), []);
  const close = useCallback(() => setOpenId(null), []);

  // Close when the route changes (e.g. clicking an action link in the drawer).
  useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  return (
    <ProfileDrawerContext.Provider value={{ openProfile }}>
      {children}
      {openId ? <ProfileDrawerPanel id={openId} onClose={close} /> : null}
    </ProfileDrawerContext.Provider>
  );
}

function ProfileDrawerPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(null);
    fetch(`/api/people/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "This profile isn't available."
              : "Couldn't load this profile."
          );
        }
        return (await res.json()) as PublicProfile;
      })
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const title = profile ? profile.name : "Member Profile";
  const subtitle = profile
    ? [profile.title, profile.chapterName, activeLabel(profile.monthsActive)]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <KanbanDetailPanel title={title} subtitle={subtitle} onClose={onClose}>
      {error ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{error}</p>
      ) : !profile ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href={`/people/${id}`}
            className="button outline small"
            style={{ alignSelf: "flex-start" }}
          >
            Open full profile
          </Link>
          <ProfileBody profile={profile} />
        </div>
      )}
    </KanbanDetailPanel>
  );
}
