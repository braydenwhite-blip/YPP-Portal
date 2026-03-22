import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicChapters } from "@/lib/chapter-join-actions";
import { JoinChapterCard } from "./join-chapter-card";

export default async function JoinChapterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // If user already has a chapter, redirect to their chapter home
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true },
  });

  if (user?.chapterId) redirect("/my-chapter");

  const chapters = await getPublicChapters();

  return (
    <main className="main-content">
      <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 32px" }}>
        <h1>Join a Chapter</h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6 }}>
          Chapters are local communities where you learn, grow, and build with
          other passionate young people. Pick a chapter to get started.
        </p>
      </div>

      {chapters.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, maxWidth: 500, margin: "0 auto" }}>
          <h3>No chapters available yet</h3>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            Check back soon, or propose your own chapter!
          </p>
          <Link href="/chapters/propose" className="button" style={{ marginTop: 16, textDecoration: "none" }}>
            Propose a Chapter
          </Link>
        </div>
      ) : (
        <div className="grid two" style={{ maxWidth: 900, margin: "0 auto" }}>
          {chapters.map((chapter) => (
            <JoinChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" style={{ color: "var(--muted)", fontSize: 14 }}>
          Skip for now
        </Link>
      </div>
    </main>
  );
}
