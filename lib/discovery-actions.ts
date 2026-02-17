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

const FALLBACK_TRY_IT_SESSIONS: TryItSessionView[] = [
  {
    id: "sample-art",
    passionId: "ARTS",
    passionName: "Arts & Visual Creation",
    title: "Try-It: Visual Arts Fundamentals",
    description: "Explore drawing, painting, and visual storytelling with a beginner-friendly activity.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    duration: 15,
    thumbnailUrl: null,
    materialsNeeded: "Paper, pencil, and colors (optional)",
    presenter: "YPP Arts Team",
    isSample: true,
  },
  {
    id: "sample-stem",
    passionId: "STEM",
    passionName: "Science & Technology",
    title: "Try-It: STEM Challenge Sprint",
    description: "Get hands-on with rapid problem solving and engineering-style thinking.",
    videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    duration: 18,
    thumbnailUrl: null,
    materialsNeeded: "Notebook and simple household materials",
    presenter: "YPP STEM Team",
    isSample: true,
  },
  {
    id: "sample-music",
    passionId: "MUSIC",
    passionName: "Music",
    title: "Try-It: Rhythm and Songwriting Basics",
    description: "Experiment with rhythm, lyrics, and simple composition in one short session.",
    videoUrl: "https://www.youtube.com/watch?v=5NV6Rdv1a3I",
    duration: 14,
    thumbnailUrl: null,
    materialsNeeded: "Phone voice notes or a notebook",
    presenter: "YPP Music Team",
    isSample: true,
  },
];

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
    return FALLBACK_TRY_IT_SESSIONS;
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
