import { MenteeRoleType } from "@prisma/client";

// Maps a user's primaryRole to the MenteeRoleType used in the program
export function toMenteeRoleType(primaryRole: string): MenteeRoleType | null {
  if (primaryRole === "INSTRUCTOR") return MenteeRoleType.INSTRUCTOR;
  if (primaryRole === "CHAPTER_LEAD") return MenteeRoleType.CHAPTER_PRESIDENT;
  if (primaryRole === "ADMIN" || primaryRole === "STAFF") return MenteeRoleType.GLOBAL_LEADERSHIP;
  return null;
}
