import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ChapterPresidentPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapter: { select: { id: true, name: true } } },
  });

  if (!currentUser?.chapter) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="badge">Chapter Presidentership</p>
            <h1 className="page-title">Your Chapter President</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ margin: 0 }}>You are not assigned to a chapter yet.</p>
        </div>
      </div>
    );
  }

  const chapterPresident = await prisma.user.findFirst({
    where: {
      chapterId: currentUser.chapter.id,
      roles: { some: { role: "CHAPTER_PRESIDENT" } },
    },
    select: { id: true, name: true, email: true },
  });

  const application = chapterPresident
    ? await prisma.chapterPresidentApplication.findFirst({
        where: { applicantId: chapterPresident.id },
        orderBy: { createdAt: "desc" },
        select: { chapterVision: true },
      })
    : null;

  const viewerIsPresident = chapterPresident?.id === currentUser.id;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="badge">Chapter Presidentership</p>
          <h1 className="page-title">Your Chapter President</h1>
          <p className="page-subtitle">{currentUser.chapter.name}</p>
        </div>
        {viewerIsPresident && (
          <Link href="/chapter/dashboard" className="button" style={{ textDecoration: "none" }}>
            President Dashboard
          </Link>
        )}
      </div>

      {viewerIsPresident && (
        <div
          className="card"
          style={{ marginBottom: 16, background: "#f0e6ff", border: "1px solid #d8b4fe" }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#6b21c8" }}>
            You lead this chapter. Manage members, events, and announcements from
            your{" "}
            <Link href="/chapter/dashboard" className="link">
              President Dashboard
            </Link>
            .
          </p>
        </div>
      )}

      {chapterPresident ? (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#6b21c8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 24,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {chapterPresident.name ? chapterPresident.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {chapterPresident.name || "Unknown"}
              </h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                {chapterPresident.email}
              </p>
            </div>
          </div>

          {application?.chapterVision && (
            <div>
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Chapter Vision
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  padding: 16,
                  margin: 0,
                }}
              >
                {application.chapterVision}
              </p>
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/chapter/calendar"
              className="button"
              style={{ textDecoration: "none" }}
            >
              Open Chapter Calendar
            </Link>
            <Link
              href="/my-chapter/calendar"
              className="button outline"
              style={{ textDecoration: "none" }}
            >
              View Member Calendar
            </Link>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Position Open</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Your chapter does not currently have a chapter president.
          </p>
          <Link
            href="/chapter/apply"
            className="button"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            Apply for Chapter President
          </Link>
        </div>
      )}
    </div>
  );
}
