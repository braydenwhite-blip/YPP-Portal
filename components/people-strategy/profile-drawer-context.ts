"use client";

import { createContext, useContext } from "react";

export type ProfileDrawerApi = {
  /** Open the slide-in profile drawer for a member id. */
  openProfile: (id: string) => void;
};

/**
 * Null when no provider is mounted — `PersonLink` then falls back to normal
 * navigation to `/people/[id]`, so the drawer is a progressive enhancement.
 */
export const ProfileDrawerContext = createContext<ProfileDrawerApi | null>(null);

export function useProfileDrawer(): ProfileDrawerApi | null {
  return useContext(ProfileDrawerContext);
}
