"use client";

import { createContext, useContext } from "react";

import type { Entity360Type } from "@/lib/operations/entity-360";

export type Entity360Api = {
  /** Open (or stack) the 360 drawer for an entity. */
  openEntity: (type: Entity360Type, id: string) => void;
};

/**
 * Null when no provider is mounted — `EntityLink` / `PersonLink` then fall
 * back to normal navigation, so the drawer stays a progressive enhancement.
 */
export const Entity360Context = createContext<Entity360Api | null>(null);

export function useEntity360(): Entity360Api | null {
  return useContext(Entity360Context);
}
