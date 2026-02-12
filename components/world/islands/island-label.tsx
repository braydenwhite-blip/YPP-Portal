"use client";

import { Billboard, Text } from "@react-three/drei";
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
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <Text
        fontSize={0.9}
        color={color}
        anchorX="center"
        anchorY="bottom"
        fontWeight={700}
        outlineWidth={0.06}
        outlineColor="#000000"
      >
        {name}
      </Text>
      <Text
        fontSize={0.55}
        color={color}
        anchorX="center"
        anchorY="top"
        position={[0, -0.15, 0]}
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {levelConfig.label} · Lv{currentLevel}
      </Text>
    </Billboard>
  );
}
