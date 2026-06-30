/**
 * Partner duplicate detection (Partner Automation, Phase 1).
 *
 * Used when manually adding or bulk-importing partners so a chapter doesn't end
 * up with three "Scarsdale Public Library" rows. Pure scoring over normalized
 * name / website domain / email domain / location / phone. Testable.
 */

export type PartnerIdentity = {
  id?: string;
  name: string;
  website?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  contactPhone?: string | null;
};

const NAME_STOPWORDS = new Set(["the", "of", "and", "a", "an", "inc", "llc"]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 0 && !NAME_STOPWORDS.has(t))
  );
}

/** Extract a bare host/domain from a URL or an email address (no leading www.). */
export function domainOf(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("@")) v = v.split("@").pop() ?? "";
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split("/")[0].split("?")[0].split(":")[0];
  return v || null;
}

/** Last 10 digits of a phone number (ignores formatting / country code). */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

/** Consumer email providers — a shared one does NOT imply the same organization. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "msn.com",
]);

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Score weights — tuned so any single strong signal (exact name, shared website
// domain, or shared phone) clears the default threshold on its own.
const W_NAME_EXACT = 65;
const W_NAME_OVERLAP = 45;
const W_WEBSITE = 50;
const W_EMAIL_DOMAIN = 30;
const W_LOCATION = 10;
const W_PHONE = 50;

export type DuplicateMatch = {
  id?: string;
  name: string;
  score: number;
  reasons: string[];
};

/** 0–100 likelihood that two partner identities are the same organization. */
export function partnerMatchScore(a: PartnerIdentity, b: PartnerIdentity): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (na && nb && na === nb) {
    score += W_NAME_EXACT;
    reasons.push("Same name");
  } else {
    const overlap = jaccard(nameTokens(a.name), nameTokens(b.name));
    if (overlap > 0) {
      score += Math.round(W_NAME_OVERLAP * overlap);
      if (overlap >= 0.5) reasons.push("Similar name");
    }
  }

  const da = domainOf(a.website);
  const db = domainOf(b.website);
  if (da && db && da === db) {
    score += W_WEBSITE;
    reasons.push("Same website");
  }

  const ea = domainOf(a.contactEmail);
  const eb = domainOf(b.contactEmail);
  if (ea && eb && ea === eb && !GENERIC_EMAIL_DOMAINS.has(ea)) {
    score += W_EMAIL_DOMAIN;
    reasons.push("Same email domain");
  }

  const la = a.location ? normalizeName(a.location) : null;
  const lb = b.location ? normalizeName(b.location) : null;
  if (la && lb && (la === lb || la.includes(lb) || lb.includes(la))) {
    score += W_LOCATION;
    reasons.push("Same location");
  }

  const pa = normalizePhone(a.contactPhone);
  const pb = normalizePhone(b.contactPhone);
  if (pa && pb && pa === pb) {
    score += W_PHONE;
    reasons.push("Same phone");
  }

  return { score: Math.min(100, score), reasons };
}

export const DEFAULT_DUPLICATE_THRESHOLD = 50;

/** Existing partners that likely duplicate `candidate`, most-likely first. */
export function findLikelyDuplicates(
  candidate: PartnerIdentity,
  existing: PartnerIdentity[],
  threshold: number = DEFAULT_DUPLICATE_THRESHOLD
): DuplicateMatch[] {
  return existing
    .filter((e) => !candidate.id || e.id !== candidate.id)
    .map((e) => {
      const { score, reasons } = partnerMatchScore(candidate, e);
      return { id: e.id, name: e.name, score, reasons };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
