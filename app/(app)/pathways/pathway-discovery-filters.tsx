"use client";

import { useRouter } from "next/navigation";

interface Props {
  areas: string[];
  activeArea: string | null;
}

export default function PathwayDiscoveryFilters({ areas, activeArea }: Props) {
  const router = useRouter();

  const setArea = (area: string | null) => {
    if (area) {
      router.push(`/pathways?area=${encodeURIComponent(area)}`);
    } else {
      router.push("/pathways");
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <button
        onClick={() => setArea(null)}
        style={{
          padding: "5px 14px",
          borderRadius: 99,
          border: "1.5px solid",
          borderColor: !activeArea ? "var(--ypp-purple)" : "var(--gray-300, #e2e8f0)",
          background: !activeArea ? "var(--ypp-purple)" : "transparent",
          color: !activeArea ? "#fff" : "var(--gray-600)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        All
      </button>
      {areas.map((area) => (
        <button
          key={area}
          onClick={() => setArea(area)}
          style={{
            padding: "5px 14px",
            borderRadius: 99,
            border: "1.5px solid",
            borderColor: activeArea === area ? "var(--ypp-purple)" : "var(--gray-300, #e2e8f0)",
            background: activeArea === area ? "var(--ypp-purple)" : "transparent",
            color: activeArea === area ? "#fff" : "var(--gray-600)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {area}
        </button>
      ))}
    </div>
  );
}
