"use client";

import { useState, useCallback } from "react";

interface IslandInteraction {
  selectedId: string | null;
  hoveredId: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  deselect: () => void;
}

export function useIslandInteraction(): IslandInteraction {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const select = useCallback((id: string | null) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const hover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const deselect = useCallback(() => {
    setSelectedId(null);
  }, []);

  return { selectedId, hoveredId, select, hover, deselect };
}
