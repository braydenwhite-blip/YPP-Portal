import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ChapterPresidentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Find the current user's chapter
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapter: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!currentUser?.chapter) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Your Chapter President
        </h1>
        <p style={{ color: "#666", marginTop: "1rem" }}>
          You are not assigned to a chapter yet.
        </p>
      </div>
    );
  }

  // Find the chapter president (user with CHAPTER_PRESIDENT role in this chapter)
  const chapterPresident = await prisma.user.findFirst({
    where: {
      chapterId: currentUser.chapter.id,
      roles: { some: { role: "CHAPTER_PRESIDENT" } },
    },
  });

  // Fetch their application for the vision statement
  let application = null;
  if (chapterPresident) {
    application = await prisma.chapterPresidentApplication.findFirst({
      where: {
        applicantId: chapterPresident.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Your Chapter President
      </h1>
      <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "2rem" }}>
        {currentUser.chapter.name}
      </p>

      {chapterPresident ? (
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "1.5rem",
                fontWeight: 700,
              }}
            >
              {chapterPresident.name
                ? chapterPresident.name.charAt(0).toUpperCase()
                : "?"}
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {chapterPresident.name || "Unknown"}
              </h2>
              <p style={{ color: "#666", fontSize: "0.875rem" }}>
                {chapterPresident.email}
              </p>
            </div>
          </div>

          {application?.chapterVision && (
            <div style={{ marginTop: "1rem" }}>
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "0.5rem",
                }}
              >
                Chapter Vision
              </h3>
              <p
                style={{
                  color: "#555",
                  fontSize: "0.875rem",
                  lineHeight: "1.6",
                  padding: "1rem",
                  backgroundColor: "#f9fafb",
                  borderRadius: "6px",
                  border: "1px solid #f3f4f6",
                }}
              >
                {application.chapterVision}
              </p>
            </div>
          )}

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href="/chapter/calendar"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                backgroundColor: "#111827",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Open Chapter Calendar
            </Link>
            <Link
              href="/my-chapter/calendar"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                backgroundColor: "#fff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              View Member Calendar
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "2rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            backgroundColor: "#f9fafb",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "0.5rem",
            }}
          >
            Position Open
          </h2>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            Your chapter does not currently have a chapter president.
          </p>
          <Link
            href="/chapter/apply"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Apply for Chapter President
          </Link>
        </div>
      )}
    </div>
  );
}
