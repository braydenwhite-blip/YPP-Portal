"use client";

/**
 * 3D compass rose sitting on the water surface.
 * Ring + cardinal direction lines + arrow indicators.
 * Uses pure mesh geometry — no Text/troika dependency.
 */
export function Compass() {
  return (
    <group position={[-60, 0.3, -55]}>
      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.06, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>

      {/* Inner ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.04, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.25} />
      </mesh>

      {/* N-S line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.04, 7, 0.01]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>

      {/* E-W line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[7, 0.04, 0.01]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>

      {/* North arrow (bright, larger) */}
      <mesh position={[0, 0.12, -3.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.4, 0.8, 3]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
      </mesh>

      {/* South indicator */}
      <mesh position={[0, 0.12, 3.8]} rotation={[-Math.PI / 2, Math.PI, 0]}>
        <coneGeometry args={[0.25, 0.5, 3]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>

      {/* East indicator */}
      <mesh position={[3.8, 0.12, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <coneGeometry args={[0.25, 0.5, 3]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>

      {/* West indicator */}
      <mesh position={[-3.8, 0.12, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.25, 0.5, 3]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>

      {/* Center diamond */}
      <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}
