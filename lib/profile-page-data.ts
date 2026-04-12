import { prisma } from "@/lib/prisma";

const profilePageInclude = {
  roles: true,
  chapter: true,
  profile: true,
  enrollments: {
    include: { course: true },
    take: 5,
    orderBy: { createdAt: "desc" as const },
  },
  courses: { take: 5 },
  certificates: {
    include: { template: true },
    take: 3,
    orderBy: { issuedAt: "desc" as const },
  },
  awards: { take: 3, orderBy: { awardedAt: "desc" as const } },
} as const;

export async function getProfilePageData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: profilePageInclude,
  });
}

export type ProfilePageUser = NonNullable<Awaited<ReturnType<typeof getProfilePageData>>>;
