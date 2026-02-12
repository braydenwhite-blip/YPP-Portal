import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getModuleById, getMyProgressForModule } from "@/lib/module-actions";
import ModuleViewerClient from "./client";

export default async function ModuleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [mod, progress] = await Promise.all([
    getModuleById(params.id),
    getMyProgressForModule(params.id),
  ]);

  if (!mod || !mod.isActive) {
    notFound();
  }

  const levelLabel = mod.level.charAt(0) + mod.level.slice(1).toLowerCase();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/learn/modules"
            style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "inline-block" }}
          >
            &larr; Back to Modules
          </Link>
          <h1 className="page-title">{mod.title}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="pill pill-purple">{levelLabel}</span>
            <span className="pill">{mod.duration} min</span>
            {mod.passionId && <span className="pill pill-info">{mod.passionId}</span>}
            {mod.viewCount > 0 && (
              <span className="pill pill-small" style={{ background: "var(--gray-100)", color: "var(--gray-600)" }}>
                {mod.viewCount} views
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid two">
        {/* Main content — video + description */}
        <div style={{ gridColumn: "1 / -1" }}>
          <ModuleViewerClient
            moduleId={mod.id}
            videoUrl={mod.videoUrl}
            duration={mod.duration * 60}
            thumbnailUrl={mod.thumbnailUrl}
            initialProgress={
              progress
                ? {
                    watchedSeconds: progress.watchTime,
                    lastPosition: progress.watchTime,
                    completed: progress.completed,
                    rating: progress.rating,
                  }
                : undefined
            }
          />
        </div>

        {/* Details card */}
        <div className="card">
          <h3>About This Module</h3>
          {mod.description && (
            <p style={{ marginBottom: 16 }}>{mod.description}</p>
          )}

          {mod.tags.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--gray-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Tags
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mod.tags.map((tag) => (
                  <span
                    key={tag}
                    className="pill pill-small"
                    style={{ background: "var(--gray-100)", color: "var(--gray-600)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mod.resources.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--gray-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Resources
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {mod.resources.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                    style={{ fontSize: 13 }}
                  >
                    Resource {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transcript card */}
        {mod.transcript && (
          <div className="card">
            <h3>Transcript</h3>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7 }}>
              {mod.transcript}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
