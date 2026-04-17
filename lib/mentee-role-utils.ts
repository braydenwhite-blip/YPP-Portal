import { MenteeRoleType } from "@prisma/client";

// Maps a user's primaryRole to the MenteeRoleType used in the program
export function toMenteeRoleType(primaryRole: string | null): MenteeRoleType | null {
  if (primaryRole === null) return null;
  if (primaryRole === "INSTRUCTOR") return MenteeRoleType.INSTRUCTOR;
  if (primaryRole === "CHAPTER_PRESIDENT") return MenteeRoleType.CHAPTER_PRESIDENT;
  if (primaryRole === "ADMIN" || primaryRole === "STAFF") return MenteeRoleType.GLOBAL_LEADERSHIP;
  return null;
}
