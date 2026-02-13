import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { LikeButton, CommentForm, AdminActions } from "./client";

const CONTENT_TYPE_COLORS: Record<string, string> = {
  VIDEO: "#ef4444", ARTICLE: "#3b82f6", PROJECT: "#7c3aed", TUTORIAL: "#16a34a",
  ART: "#ec4899", MUSIC: "#d97706", CODE: "#06b6d4", OTHER: "#6b7280",
};

const SHOWCASE_TABLES = new Set(
  ["StudentContent", "ContentComment", "ContentLike"].flatMap((tableName) => [
    tableName,
    `public.${tableName}`,
  ])
);

function isMissingShowcaseTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { table?: string } };
  return (
    prismaError.code === "P2021" &&
    typeof prismaError.meta?.table === "string" &&
    SHOWCASE_TABLES.has(prismaError.meta.table)
  );
}

const SHOWCASE_CONTENT_INCLUDE = {
  student: { select: { id: true, name: true, level: true } },
  comments: {
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  },
  likes: { select: { userId: true } },
} satisfies Prisma.StudentContentInclude;

export default async function ShowcaseDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  type ShowcaseContent = Prisma.StudentContentGetPayload<{
    include: typeof SHOWCASE_CONTENT_INCLUDE;
  }> | null;
  let content: ShowcaseContent = null;
  let showcaseUnavailable = false;
  try {
    content = await prisma.studentContent.findUnique({
      where: { id: params.id },
      include: SHOWCASE_CONTENT_INCLUDE,
    });
  } catch (error) {
    if (isMissingShowcaseTableError(error)) {
      showcaseUnavailable = true;
    } else {
      throw error;
    }
  }

  if (!content) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Not Found</h1>
        </div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            {showcaseUnavailable
              ? "Showcase is temporarily unavailable while database updates finish. Please try again in a few minutes."
              : "This content does not exist."}
          </p>
          <Link href="/showcase" className="button secondary" style={{ marginTop: 12 }}>
            Back to Showcase
          </Link>
        </div>
      </div>
    );
  }

  const userLiked = content.likes.some((l) => l.userId === session.user.id);
  const isAdmin = (session.user as any).roles?.includes("ADMIN") || (session.user as any).primaryRole === "ADMIN";
  const isInstructor = (session.user as any).roles?.includes("INSTRUCTOR") || (session.user as any).primaryRole === "INSTRUCTOR";

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{content.title}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            by {content.student.name} &middot; Level {content.student.level}
          </p>
        </div>
        <Link href="/showcase" className="button secondary">Back to Showcase</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Main content */}
        <div>
          {/* Thumbnail / media */}
          <div
            className="card"
            style={{
              height: 240,
              backgroundColor: CONTENT_TYPE_COLORS[content.contentType] || "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {content.mediaUrl ? (
              <a href={content.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "underline" }}>
                View {content.contentType.toLowerCase()}
              </a>
            ) : (
              content.contentType
            )}
          </div>

          {content.isFeatured && (
            <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: 8, padding: "8px 16px", marginBottom: 16, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
              Featured Content
            </div>
          )}

          <div className="card">
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <span className="pill" style={{ backgroundColor: CONTENT_TYPE_COLORS[content.contentType], color: "#fff" }}>
                {content.contentType}
              </span>
              {content.passionArea && <span className="pill">{content.passionArea}</span>}
              <span className="pill" style={{ fontSize: 11 }}>
                {content.status}
              </span>
            </div>

            {content.description && (
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                {content.description}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
              <LikeButton contentId={content.id} initialLikes={content.likeCount} initialLiked={userLiked} />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {content.comments.length} comments
              </span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {content.viewCount} views
              </span>
            </div>
          </div>

          {/* Comments */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Comments</h3>
            <CommentForm contentId={content.id} />
            {content.comments.length > 0 ? (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {content.comments.map((c) => (
                  <div key={c.id} style={{ borderBottom: "1px solid var(--gray-200)", paddingBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.author.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{c.text}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>
                No comments yet. Be the first!
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card">
            <h4 style={{ marginBottom: 12 }}>About the Creator</h4>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{content.student.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Level {content.student.level}</div>
          </div>

          {(isAdmin || isInstructor) && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 12 }}>Admin Actions</h4>
              <AdminActions contentId={content.id} status={content.status} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
