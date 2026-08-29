export type HiringWaitlistKind = "instructor" | "cp" | "staff";

export type HiringWaitlistEntry = {
  key: string;
  kind: HiringWaitlistKind;
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  subjects: string | null;
  chapterName: string | null;
  waitlistedAt: string;
  href: string;
  reviewHref: string;
};

export function waitlistKey(kind: HiringWaitlistKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseWaitlistKey(
  key: string
): { kind: HiringWaitlistKind; id: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const kind = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if ((kind !== "instructor" && kind !== "cp" && kind !== "staff") || !id) {
    return null;
  }
  return { kind, id };
}
