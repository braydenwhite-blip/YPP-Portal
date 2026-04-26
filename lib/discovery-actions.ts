import { prisma } from "@/lib/prisma";

export type TryItSessionView = {
  id: string;
  passionId: string;
  passionName: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number;
  thumbnailUrl: string | null;
  materialsNeeded: string | null;
  presenter: string | null;
  isSample: boolean;
};

function titleCaseFromKey(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getTryItSessions(): Promise<TryItSessionView[]> {
  const [sessions, passions] = await Promise.all([
    prisma.tryItSession
      .findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      })
      .catch(() => []),
    prisma.passionArea
      .findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true },
      })
      .catch(() => []),
  ]);

  if (sessions.length === 0) {
    return [];
  }

  const passionById = new Map(passions.map((p) => [p.id, p.name]));
  const passionByCategory = new Map(passions.map((p) => [p.category, p.name]));

  return sessions.map((session) => {
    const normalizedKey = session.passionId.toUpperCase();
    const passionName =
      passionById.get(session.passionId) ??
      passionByCategory.get(normalizedKey as any) ??
      titleCaseFromKey(session.passionId);

    return {
      id: session.id,
      passionId: session.passionId,
      passionName,
      title: session.title,
      description: session.description,
      videoUrl: session.videoUrl,
      duration: session.duration,
      thumbnailUrl: session.thumbnailUrl ?? null,
      materialsNeeded: session.materialsNeeded ?? null,
      presenter: session.presenter ?? null,
      isSample: false,
    };
  });
}

export async function getTryItSessionById(sessionId: string): Promise<TryItSessionView | null> {
  const sessions = await getTryItSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}
