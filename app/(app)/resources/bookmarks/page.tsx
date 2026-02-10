import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BookmarksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's bookmarks with resources
  const bookmarks = await prisma.resourceBookmark.findMany({
    where: { userId: session.user.id },
    include: {
      resource: {
        include: {
          uploadedBy: true,
          course: true
        }
      },
      folder: true
    },
    orderBy: { createdAt: "desc" }
  });

  // Get user's folders
  const folders = await prisma.bookmarkFolder.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { bookmarks: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  // Group bookmarks by folder
  const bookmarksByFolder = bookmarks.reduce((acc, bookmark) => {
    const folderId = bookmark.folderId || "unfiled";
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(bookmark);
    return acc;
  }, {} as Record<string, typeof bookmarks>);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Learning</p>
          <h1 className="page-title">Bookmarked Resources</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/resources/bookmarks/folders" className="button secondary">
            Manage Folders
          </Link>
          <Link href="/resources" className="button primary">
            Browse Resources
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>Your Resource Library</h3>
          <p>
            Bookmark resources for quick access. Organize them into folders to keep everything tidy.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{bookmarks.length}</div>
              <div className="kpi-label">Bookmarks</div>
            </div>
            <div>
              <div className="kpi">{folders.length}</div>
              <div className="kpi-label">Folders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Folders sidebar */}
      {folders.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Your Folders</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/resources/bookmarks"
              className="pill"
              style={{
                textDecoration: "none",
                padding: "8px 16px",
                backgroundColor: "var(--accent-bg)"
              }}
            >
              📁 All Bookmarks ({bookmarks.length})
            </Link>
            {folders.map(folder => (
              <Link
                key={folder.id}
                href={`/resources/bookmarks?folder=${folder.id}`}
                className="pill"
                style={{
                  textDecoration: "none",
                  padding: "8px 16px"
                }}
              >
                📂 {folder.name} ({folder._count.bookmarks})
              </Link>
            ))}
          </div>
        </div>
      )}

      {bookmarks.length === 0 ? (
        <div className="card">
          <h3>No Bookmarks Yet</h3>
          <p>
            Start bookmarking useful resources to build your personal library!
          </p>
          <Link href="/resources" className="button primary" style={{ marginTop: 12 }}>
            Browse Resources
          </Link>
        </div>
      ) : (
        <div>
          {/* Unfiled bookmarks */}
          {bookmarksByFolder["unfiled"] && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-title">Unfiled</div>
              <div className="grid two">
                {bookmarksByFolder["unfiled"].map(bookmark => (
                  <div key={bookmark.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <a
                          href={bookmark.resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: "var(--primary-color)",
                            textDecoration: "none"
                          }}
                        >
                          {bookmark.resource.title} ↗
                        </a>
                        {bookmark.resource.description && (
                          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
                            {bookmark.resource.description}
                          </p>
                        )}
                      </div>
                      <form action="/api/resources/unbookmark" method="POST">
                        <input type="hidden" name="bookmarkId" value={bookmark.id} />
                        <button
                          type="submit"
                          className="button small"
                          style={{ backgroundColor: "transparent", color: "var(--text-secondary)" }}
                        >
                          ✕
                        </button>
                      </form>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="pill">{bookmark.resource.type.replace("_", " ")}</span>
                      {bookmark.resource.course && (
                        <span className="pill">{bookmark.resource.course.title}</span>
                      )}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      Uploaded by {bookmark.resource.uploadedBy.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookmarks by folder */}
          {folders.map(folder => {
            const folderBookmarks = bookmarksByFolder[folder.id];
            if (!folderBookmarks || folderBookmarks.length === 0) return null;

            return (
              <div key={folder.id} style={{ marginBottom: 28 }}>
                <div className="section-title">📂 {folder.name}</div>
                <div className="grid two">
                  {folderBookmarks.map(bookmark => (
                    <div key={bookmark.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div style={{ flex: 1 }}>
                          <a
                            href={bookmark.resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: "var(--primary-color)",
                              textDecoration: "none"
                            }}
                          >
                            {bookmark.resource.title} ↗
                          </a>
                          {bookmark.resource.description && (
                            <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
                              {bookmark.resource.description}
                            </p>
                          )}
                        </div>
                        <form action="/api/resources/unbookmark" method="POST">
                          <input type="hidden" name="bookmarkId" value={bookmark.id} />
                          <button
                            type="submit"
                            className="button small"
                            style={{ backgroundColor: "transparent", color: "var(--text-secondary)" }}
                          >
                            ✕
                          </button>
                        </form>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="pill">{bookmark.resource.type.replace("_", " ")}</span>
                        {bookmark.resource.course && (
                          <span className="pill">{bookmark.resource.course.title}</span>
                        )}
                      </div>

                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                        Uploaded by {bookmark.resource.uploadedBy.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
