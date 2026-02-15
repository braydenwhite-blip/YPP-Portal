"use client";

import { Label3D } from "../scene/label-3d";
import { LEVEL_LABELS } from "../constants";

interface IslandLabelProps {
  name: string;
  level: string;
  currentLevel: number;
  color: string;
  position: [number, number, number];
}

export function IslandLabel({ name, level, currentLevel, color, position }: IslandLabelProps) {
  const levelConfig = LEVEL_LABELS[level] ?? LEVEL_LABELS.EXPLORING;

  return (
    <Label3D position={position} color={color} fontSize={16} bold outline>
      {name}
      <br />
      <span style={{ fontSize: "11px" }}>{levelConfig.label} · Lv{currentLevel}</span>
    </Label3D>
  );
}
