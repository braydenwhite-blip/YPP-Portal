/** Shared @mention parsing helpers for comment composers. */

export const MENTION_HANDLE_REGEX = /@([a-z0-9._-]{1,40})/gi;
export const MENTION_TOKEN_REGEX = /^@[a-z0-9._-]+$/i;

export type MentionableUser = {
  id: string;
  name: string | null;
  email: string;
};

export type ActiveMentionMatch = {
  start: number;
  end: number;
  query: string;
};

export function userMentionHandle(user: { name: string | null; email: string }): string {
  return (user.name ?? user.email.split("@")[0]).replace(/\s+/g, "").toLowerCase();
}

export function extractMentionHandles(body: string): string[] {
  const matches = body.match(MENTION_HANDLE_REGEX) ?? [];
  return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())));
}

export function resolveMentionedUserIds(
  body: string,
  candidates: MentionableUser[]
): string[] {
  const handles = extractMentionHandles(body);
  if (handles.length === 0) return [];

  const handleSet = new Set(handles);
  const ids: string[] = [];

  for (const user of candidates) {
    const normalized = userMentionHandle(user);
    const emailLocal = user.email.split("@")[0].toLowerCase();
    if (handleSet.has(normalized) || handleSet.has(emailLocal)) {
      ids.push(user.id);
    }
  }

  return Array.from(new Set(ids));
}

/** Walk back from the caret to find an active `@` token being typed. */
export function findActiveMention(text: string, caret: number): ActiveMentionMatch | null {
  if (caret <= 0) return null;

  for (let index = caret - 1; index >= Math.max(0, caret - 40); index -= 1) {
    const char = text[index];
    if (char === "@") {
      const before = index === 0 ? " " : text[index - 1];
      if (before && /[\s(]/.test(before) === false && index !== 0) continue;
      return { start: index, end: caret, query: text.slice(index + 1, caret) };
    }
    if (/\s/.test(char)) return null;
  }

  return null;
}

export function filterMentionableUsers(
  users: MentionableUser[],
  query: string,
  limit = 6
): MentionableUser[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];

  return users
    .filter((user) => {
      const handle = userMentionHandle(user);
      const haystack = `${user.name ?? ""} ${user.email} ${handle}`.toLowerCase();
      return haystack.includes(trimmed);
    })
    .slice(0, limit);
}
