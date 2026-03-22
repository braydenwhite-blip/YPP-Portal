"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function MemberSearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    router.push(`/chapter/members?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSearch} style={{ marginBottom: 20, display: "flex", gap: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search members by name or email..."
        className="input"
        style={{ flex: 1 }}
      />
      <button type="submit" className="button small">
        Search
      </button>
      {value && (
        <button
          type="button"
          className="button small secondary"
          onClick={() => {
            setValue("");
            router.push("/chapter/members");
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
