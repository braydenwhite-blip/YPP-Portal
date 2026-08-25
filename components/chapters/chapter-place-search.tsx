"use client";

import { useEffect, useRef, useState } from "react";

import { searchChapterPlaces, type PlaceHit } from "@/lib/chapters/place-search";

const fieldClass =
  "rounded-[10px] border border-line-card px-3 py-2 text-[14px] font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function ChapterPlaceSearch({
  city,
  state,
  country,
  onChange,
}: {
  city: string;
  state: string;
  country: string;
  onChange: (next: { city: string; state: string; country: string }) => void;
}) {
  const [query, setQuery] = useState([city, state, country].filter(Boolean).join(", "));
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const selected = [city, state, country].filter(Boolean).join(", ");
    if (q === selected) {
      setHits([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const rows = await searchChapterPlaces({ query: q });
      if (seq.current !== id) return;
      setHits(rows);
      setSearching(false);
      setOpen(true);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, city, state, country]);

  function pick(hit: PlaceHit) {
    onChange({ city: hit.city, state: hit.state, country: hit.country });
    setQuery(hit.label);
    setHits([]);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
        Place
        <input
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Search a city, like Scarsdale"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (!next.trim()) onChange({ city: "", state: "", country: "" });
          }}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          className={fieldClass}
        />
      </label>
      {open && query.trim().length >= 2 && query.trim() !== [city, state, country].filter(Boolean).join(", ") ? (
        <ul className="absolute z-20 m-0 mt-1 w-full list-none overflow-hidden rounded-[10px] border border-line-card bg-surface p-0 shadow-card">
          {searching && hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-muted">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-muted">No places match. Type city, state, and country below.</li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id} className="border-b border-line-card last:border-b-0">
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-brand-50"
                >
                  <span className="text-[13.5px] font-semibold text-ink">
                    {[hit.city, hit.state].filter(Boolean).join(", ")}
                  </span>
                  {hit.country ? (
                    <span className="text-[12px] text-ink-muted">{hit.country}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
