import { prisma } from "@/lib/prisma";

export type StudentClassHistoryItem = {
  enrollmentId: string;
  offeringId: string;
  title: string;
  status: string;
  statusLabel: string;
  instructorName: string | null;
  chapterName: string | null;
  partnerName: string | null;
  semester: string | null;
  offeringStartDate: string | null;
  offeringEndDate: string | null;
  enrolledAt: string | null;
  completedAt: string | null;
  droppedAt: string | null;
};

export type StudentFamilyMember = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  relationship: string;
  kind: "parent" | "guardian" | "sibling" | "other";
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  CHAPTER_PRESIDENT: "Chapter President",
  HIRING_CHAIR: "Hiring Chair",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
  STUDENT: "Student",
  PARENT: "Parent",
  APPLICANT: "Applicant",
};

function enrollmentStatusLabel(status: string) {
  switch (status) {
    case "ENROLLED":
      return "In class";
    case "COMPLETED":
      return "Completed";
    case "DROPPED":
      return "Left class";
    default:
      return status.replaceAll("_", " ");
  }
}

function familyKind(relationship: string): StudentFamilyMember["kind"] {
  const rel = relationship.toLowerCase();
  if (/sibling|brother|sister/.test(rel)) return "sibling";
  if (/guardian/.test(rel)) return "guardian";
  if (/parent|mother|father|mom|dad/.test(rel)) return "parent";
  return "other";
}

/**
 * Class history for roster students: every YPP offering they joined
 * (excluding waitlist-only seats).
 */
export async function loadStudentClassHistories(
  studentIds: string[],
): Promise<Map<string, StudentClassHistoryItem[]>> {
  const map = new Map<string, StudentClassHistoryItem[]>();
  if (studentIds.length === 0) return map;

  const rows = await prisma.classEnrollment.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: ["ENROLLED", "COMPLETED", "DROPPED"] },
    },
    select: {
      id: true,
      studentId: true,
      status: true,
      enrolledAt: true,
      completedAt: true,
      droppedAt: true,
      offering: {
        select: {
          id: true,
          title: true,
          semester: true,
          startDate: true,
          endDate: true,
          instructor: { select: { name: true } },
          chapter: { select: { name: true } },
          partner: { select: { name: true } },
        },
      },
    },
    orderBy: [{ enrolledAt: "desc" }],
  });

  for (const row of rows) {
    const item: StudentClassHistoryItem = {
      enrollmentId: row.id,
      offeringId: row.offering.id,
      title: row.offering.title,
      status: row.status,
      statusLabel: enrollmentStatusLabel(row.status),
      instructorName: row.offering.instructor?.name ?? null,
      chapterName: row.offering.chapter?.name ?? null,
      partnerName: row.offering.partner?.name ?? null,
      semester: row.offering.semester,
      offeringStartDate: row.offering.startDate?.toISOString() ?? null,
      offeringEndDate: row.offering.endDate?.toISOString() ?? null,
      enrolledAt: row.enrolledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      droppedAt: row.droppedAt?.toISOString() ?? null,
    };
    const list = map.get(row.studentId) ?? [];
    list.push(item);
    map.set(row.studentId, list);
  }

  return map;
}

/**
 * Family linked to roster students: parents/guardians from ParentStudent (+
 * StudentGuardianRelationship when present), and siblings who share a parent.
 */
export async function loadStudentFamilies(
  studentIds: string[],
): Promise<Map<string, StudentFamilyMember[]>> {
  const map = new Map<string, StudentFamilyMember[]>();
  if (studentIds.length === 0) return map;
  for (const id of studentIds) map.set(id, []);

  const parentLinks = await prisma.parentStudent.findMany({
    where: {
      studentId: { in: studentIds },
      archivedAt: null,
      approvalStatus: { in: ["APPROVED", "PENDING"] },
    },
    select: {
      id: true,
      studentId: true,
      parentId: true,
      relationship: true,
      parent: { select: { id: true, name: true, email: true } },
    },
  });

  const parentIds = [...new Set(parentLinks.map((l) => l.parentId))];

  const allKidsOfParents =
    parentIds.length > 0
      ? await prisma.parentStudent.findMany({
          where: {
            parentId: { in: parentIds },
            archivedAt: null,
            approvalStatus: { in: ["APPROVED", "PENDING"] },
          },
          select: {
            parentId: true,
            studentId: true,
            student: { select: { id: true, name: true, email: true } },
          },
        })
      : [];

  let guardianRels: Array<{
    id: string;
    studentUserId: string;
    relationshipType: string;
    guardianUser: { id: string; name: string | null; email: string | null };
  }> = [];
  try {
    guardianRels = await (prisma as any).studentGuardianRelationship.findMany({
      where: {
        studentUserId: { in: studentIds },
        revokedAt: null,
      },
      select: {
        id: true,
        studentUserId: true,
        relationshipType: true,
        guardianUser: { select: { id: true, name: true, email: true } },
      },
    });
  } catch {
    guardianRels = [];
  }

  const pushUnique = (studentId: string, member: StudentFamilyMember) => {
    const list = map.get(studentId) ?? [];
    if (list.some((m) => m.userId === member.userId)) return;
    list.push(member);
    map.set(studentId, list);
  };

  for (const link of parentLinks) {
    const relationship = (link.relationship || "Parent").trim() || "Parent";
    pushUnique(link.studentId, {
      id: link.id,
      userId: link.parent.id,
      name: link.parent.name?.trim() || "Family member",
      email: link.parent.email,
      relationship,
      kind: familyKind(relationship),
    });
  }

  for (const rel of guardianRels) {
    pushUnique(rel.studentUserId, {
      id: rel.id,
      userId: rel.guardianUser.id,
      name: rel.guardianUser.name?.trim() || "Guardian",
      email: rel.guardianUser.email,
      relationship: rel.relationshipType || "Guardian",
      kind: "guardian",
    });
  }

  const kidsByParent = new Map<string, typeof allKidsOfParents>();
  for (const row of allKidsOfParents) {
    const list = kidsByParent.get(row.parentId) ?? [];
    list.push(row);
    kidsByParent.set(row.parentId, list);
  }

  for (const link of parentLinks) {
    const kids = kidsByParent.get(link.parentId) ?? [];
    for (const kid of kids) {
      if (kid.studentId === link.studentId) continue;
      pushUnique(link.studentId, {
        id: `sib-${link.parentId}-${kid.studentId}`,
        userId: kid.student.id,
        name: kid.student.name?.trim() || "Sibling",
        email: kid.student.email,
        relationship: "Sibling",
        kind: "sibling",
      });
    }
  }

  const kindOrder = { parent: 0, guardian: 1, other: 2, sibling: 3 } as const;
  for (const [sid, list] of map) {
    list.sort(
      (a, b) =>
        kindOrder[a.kind] - kindOrder[b.kind] ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    map.set(sid, list);
  }

  return map;
}

export function personRoleLabel(role: string | null | undefined) {
  if (!role) return "Student";
  return ROLE_LABEL[role] ?? role;
}
