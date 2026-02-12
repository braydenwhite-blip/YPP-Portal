"use client";

import { useState, useCallback } from "react";
import { VideoPlayer } from "@/components/video-player";
import { updateWatchProgress, completeModule } from "@/lib/module-actions";

interface ModuleViewerClientProps {
  moduleId: string;
  videoUrl: string;
  duration: number; // in seconds
  thumbnailUrl?: string | null;
  initialProgress?: {
    watchedSeconds: number;
    lastPosition: number;
    completed: boolean;
    rating: number | null;
  };
}

function detectProvider(url: string): "YOUTUBE" | "VIMEO" | "LOOM" | "CUSTOM" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YOUTUBE";
  if (url.includes("vimeo.com")) return "VIMEO";
  if (url.includes("loom.com")) return "LOOM";
  return "CUSTOM";
}

export default function ModuleViewerClient({
  moduleId,
  videoUrl,
  duration,
  thumbnailUrl,
  initialProgress,
}: ModuleViewerClientProps) {
  const [isCompleted, setIsCompleted] = useState(
    initialProgress?.completed ?? false,
  );
  const [rating, setRating] = useState<number | null>(
    initialProgress?.rating ?? null,
  );
  const [completing, setCompleting] = useState(false);

  const provider = detectProvider(videoUrl);

  const handleProgress = useCallback(
    async (watchedSeconds: number, _lastPosition: number, completed: boolean) => {
      try {
        await updateWatchProgress(moduleId, watchedSeconds);
        if (completed && !isCompleted) {
          setIsCompleted(true);
        }
      } catch {
        // Non-critical — don't block the user
      }
    },
    [moduleId, isCompleted],
  );

  const handleMarkComplete = async () => {
    setCompleting(true);
    try {
      await completeModule(moduleId, rating ?? undefined);
      setIsCompleted(true);
    } catch {
      // Error handling
    }
    setCompleting(false);
  };

  return (
    <div>
      {/* Video */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <VideoPlayer
          videoUrl={videoUrl}
          provider={provider}
          duration={duration}
          thumbnail={thumbnailUrl ?? undefined}
          moduleId={moduleId}
          initialProgress={
            initialProgress
              ? {
                  watchedSeconds: initialProgress.watchedSeconds,
                  lastPosition: initialProgress.lastPosition,
                  completed: initialProgress.completed,
                }
              : undefined
          }
          onProgress={handleProgress}
        />
      </div>

      {/* Completion section */}
      <div
        className="card"
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {isCompleted ? (
          <>
            <div>
              <span
                className="pill pill-success"
                style={{ fontSize: 13, padding: "4px 12px" }}
              >
                Completed
              </span>
              <span
                style={{
                  marginLeft: 12,
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                +15 XP earned
              </span>
            </div>
            {/* Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Rate this module:
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={async () => {
                      setRating(star);
                      try {
                        await completeModule(moduleId, star);
                      } catch {
                        // Non-critical
                      }
                    }}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 20,
                      opacity: rating && star <= rating ? 1 : 0.3,
                      transition: "opacity 150ms",
                      padding: 0,
                    }}
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    {"\u2605"}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
              Done watching? Mark this module as complete to earn XP.
            </p>
            <button
              type="button"
              className="button small"
              style={{ marginTop: 0 }}
              onClick={handleMarkComplete}
              disabled={completing}
            >
              {completing ? "Saving..." : "Mark as Complete"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
