"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function ChapterFilter({
  chapters,
  selected,
  coverage,
}: {
  chapters: { id: string; name: string }[];
  selected: string | null;
  coverage: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      next.delete("chapter");
    } else {
      next.set("chapter", value);
    }
    if (coverage && coverage !== "all") {
      next.set("coverage", coverage);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?");
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <label
        htmlFor="chapter-filter"
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
      >
        Chapter:
      </label>
      <select
        id="chapter-filter"
        defaultValue={selected ?? "all"}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        style={{
          fontSize: 13,
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <option value="all">All chapters</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
