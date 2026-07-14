/**
 * Contact blocks for G&R documents — matches the paper format:
 * Officer/Manager Information + Mentor Information (name, title, phone, email).
 */

export type GRContactPerson = {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  chapter: string | null;
};

type UserLike = {
  name: string | null;
  email: string | null;
  phone?: string | null;
  title?: string | null;
  canonicalTitle?: string | null;
  primaryRole?: string | null;
  chapter?: { name: string } | null;
};

const ROLE_FALLBACK: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  MENTOR: "Mentor",
  STAFF: "Staff",
  ADMIN: "Admin",
  HIRING_CHAIR: "Hiring Chair",
  STUDENT: "Student",
  PARENT: "Parent",
  APPLICANT: "Applicant",
};

function displayTitle(user: UserLike, fallback?: string | null): string | null {
  return (
    user.canonicalTitle?.trim() ||
    user.title?.trim() ||
    fallback?.trim() ||
    (user.primaryRole ? ROLE_FALLBACK[user.primaryRole] ?? null : null)
  );
}

export function toGRContact(
  user: UserLike | null | undefined,
  opts?: { titleFallback?: string | null }
): GRContactPerson | null {
  if (!user) return null;
  const name = (user.name || user.email || "").trim();
  if (!name) return null;
  return {
    name,
    title: displayTitle(user, opts?.titleFallback),
    email: user.email?.trim() || null,
    phone: user.phone?.trim() || null,
    chapter: user.chapter?.name?.trim() || null,
  };
}

export function buildGROfficerInfo(
  mentee: UserLike,
  templatePosition?: string | null
): GRContactPerson {
  return (
    toGRContact(mentee, { titleFallback: templatePosition }) ?? {
      name: "Unknown",
      title: templatePosition ?? null,
      email: null,
      phone: null,
      chapter: null,
    }
  );
}

export function buildGRMentorList(input: {
  mentor: UserLike | null | undefined;
  chair?: UserLike | null | undefined;
}): GRContactPerson[] {
  const mentors: GRContactPerson[] = [];
  const primary = toGRContact(input.mentor);
  if (primary) mentors.push(primary);
  const chair = toGRContact(input.chair);
  if (chair && chair.email !== primary?.email) mentors.push(chair);
  return mentors;
}
