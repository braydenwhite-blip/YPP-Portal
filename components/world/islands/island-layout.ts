// ═══════════════════════════════════════════════════════════════
// Island Layout — Golden-Angle Spiral Positioning
// ═══════════════════════════════════════════════════════════════

/** 2D positions for the SVG renderer */
export function getIslandPositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const centerX = 600;
  const centerY = 400;

  for (let i = 0; i < count; i++) {
    const radius = 120 + Math.sqrt(i) * 110;
    const angle = i * goldenAngle;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius * 0.65,
    });
  }
  return positions;
}

/** 3D positions for the R3F renderer — maps the same spiral onto the XZ plane */
export function getIslandPositions3D(
  count: number,
): { x: number; y: number; z: number }[] {
  const positions: { x: number; y: number; z: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const radius = 15 + Math.sqrt(i) * 14;
    const angle = i * goldenAngle;
    positions.push({
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
    });
  }
  return positions;
}
