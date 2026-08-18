"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";

export type PlaceHit = {
  id: string;
  city: string;
  state: string;
  country: string;
  label: string;
};

const QuerySchema = z.object({
  query: z.string().trim().min(2).max(80),
});

const US_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const PLACE_VALUES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "suburb",
  "municipality",
  "borough",
  "locality",
]);

type PhotonFeature = {
  properties?: {
    osm_id?: number;
    osm_value?: string;
    type?: string;
    name?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const cache = new Map<string, { at: number; hits: PlaceHit[] }>();
const CACHE_MS = 10 * 60 * 1000;

function usState(value: string, country: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  const isUS = /^(us|usa|united states)$/i.test(country.trim());
  if (!isUS) return trimmed;
  return US_ABBR[trimmed.toLowerCase()] ?? trimmed;
}

const SKIP_VALUES = new Set(["station", "farm", "house", "platform", "motorway"]);
const SKIP_TYPES = new Set(["house", "street"]);

function toHit(feature: PhotonFeature): PlaceHit | null {
  const p = feature.properties;
  if (!p) return null;
  if (p.osm_value && SKIP_VALUES.has(p.osm_value)) return null;
  if (p.type && SKIP_TYPES.has(p.type)) return null;
  const settlement =
    PLACE_VALUES.has(p.osm_value ?? "") ||
    p.type === "city" ||
    p.type === "district" ||
    p.type === "locality";
  if (!settlement) return null;
  const city = (p.name || p.city || p.town || p.village || "").trim();
  const country = (p.country || "").trim();
  const state = usState(p.state || "", country);
  if (!city) return null;
  const parts = [city, state, country].filter((part, i, all) => part && all.indexOf(part) === i);
  return {
    id: String(p.osm_id ?? `${city}-${state}-${country}`),
    city,
    state,
    country,
    label: parts.join(", "),
  };
}

export async function searchChapterPlaces(input: unknown): Promise<PlaceHit[]> {
  const parsed = QuerySchema.safeParse(input);
  if (!parsed.success) return [];
  await requireSessionUser();

  const key = parsed.data.query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hits;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", parsed.data.query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "YPP-Pathways-Portal/1.0 (chapter-place-search)",
      },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const hits: PlaceHit[] = [];
    for (const feature of body.features ?? []) {
      const hit = toHit(feature);
      if (!hit) continue;
      const dedupe = `${hit.city}|${hit.state}|${hit.country}`.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      hits.push(hit);
      if (hits.length >= 6) break;
    }
    cache.set(key, { at: Date.now(), hits });
    return hits;
  } catch {
    return [];
  }
}
