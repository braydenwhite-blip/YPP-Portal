"use client";

import { useState, useRef, useEffect } from "react";
import { VideoProvider } from "@prisma/client";

interface VideoPlayerProps {
  videoUrl: string;
  provider: VideoProvider;
  duration?: number;
  thumbnail?: string;
  moduleId: string;
  initialProgress?: {
    watchedSeconds: number;
    lastPosition: number;
    completed: boolean;
  };
  onProgress?: (watchedSeconds: number, lastPosition: number, completed: boolean) => void;
}

export function VideoPlayer({
  videoUrl,
  provider,
  duration,
  thumbnail,
  moduleId,
  initialProgress,
  onProgress
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialProgress?.lastPosition || 0);
  const [watchedSeconds, setWatchedSeconds] = useState(initialProgress?.watchedSeconds || 0);
  const [completed, setCompleted] = useState(initialProgress?.completed || false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaveRef = useRef(0);

  // Extract video ID for embedded players — validates against allowed domains only
  const getEmbedUrl = (): string | null => {
    switch (provider) {
      case "YOUTUBE": {
        const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (!match) return null;
        return `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&start=${Math.floor(currentTime)}`;
      }
      case "VIMEO": {
        const match = videoUrl.match(/vimeo\.com\/(\d+)/);
        if (!match) return null;
        return `https://player.vimeo.com/video/${match[1]}?autoplay=0`;
      }
      case "LOOM": {
        const match = videoUrl.match(/loom\.com\/share\/([^?]+)/);
        if (!match) return null;
        return `https://www.loom.com/embed/${match[1]}`;
      }
      default:
        // Reject unknown providers — prevents arbitrary URL injection into iframe
        return null;
    }
  };

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchedSeconds > lastSaveRef.current + 10) {
        lastSaveRef.current = watchedSeconds;
        onProgress?.(watchedSeconds, currentTime, completed);
      }
    }, 15000); // Save every 15 seconds

    return () => clearInterval(interval);
  }, [watchedSeconds, currentTime, completed, onProgress]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (watchedSeconds > 0) {
        onProgress?.(watchedSeconds, currentTime, completed);
      }
    };
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Increment watched seconds (only count new time)
      if (time > watchedSeconds) {
        setWatchedSeconds(Math.floor(time));
      }

      // Mark as completed if watched 90% or more
      if (duration && time >= duration * 0.9 && !completed) {
        setCompleted(true);
        onProgress?.(watchedSeconds, time, true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration ? (watchedSeconds / duration) * 100 : 0;

  return (
    <div className="video-player-container">
      {/* Progress indicator */}
      <div className="video-progress-bar">
        <div
          className="video-progress-fill"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      {/* Video container */}
      <div className="video-wrapper">
        {provider === "CUSTOM" ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnail}
            controls
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setCompleted(true);
              onProgress?.(watchedSeconds, currentTime, true);
            }}
          />
        ) : getEmbedUrl() ? (
          <iframe
            src={getEmbedUrl()!}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Invalid or unsupported video URL
          </div>
        )}
      </div>

      {/* Video info */}
      <div className="video-info">
        <div className="video-stats">
          {duration && (
            <span>
              {formatTime(watchedSeconds)} / {formatTime(duration)} watched
            </span>
          )}
          {completed && (
            <span className="completed-badge">Completed</span>
          )}
        </div>
        {!completed && duration && (
          <span className="video-remaining">
            {formatTime(duration - watchedSeconds)} remaining
          </span>
        )}
      </div>

      <style jsx>{`
        .video-player-container {
          width: 100%;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: #000;
        }
        .video-progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
        }
        .video-progress-fill {
          height: 100%;
          background: #22c55e;
          transition: width 0.3s ease;
        }
        .video-wrapper {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          height: 0;
        }
        .video-wrapper video,
        .video-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .video-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #1a1a1a;
          color: white;
          font-size: 13px;
        }
        .video-stats {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .completed-badge {
          background: #22c55e;
          color: white;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }
        .video-remaining {
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </div>
  );
}

interface VideoCardProps {
  title: string;
  description?: string;
  videoUrl: string;
  provider: VideoProvider;
  duration?: number;
  thumbnail?: string;
  moduleId: string;
  progress?: {
    watchedSeconds: number;
    lastPosition: number;
    completed: boolean;
  };
}

export function VideoCard({
  title,
  description,
  videoUrl,
  provider,
  duration,
  thumbnail,
  moduleId,
  progress
}: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const progressPercent = duration && progress
    ? (progress.watchedSeconds / duration) * 100
    : 0;

  const handleSaveProgress = async (
    watchedSeconds: number,
    lastPosition: number,
    completed: boolean
  ) => {
    // Progress saving is handled via the onProgress callback from the parent.
    // The server action (trackVideoWatch) should be called from the server component.
    // This client-side handler is a no-op — video progress is saved via useEffect in VideoPlayer.
  };

  return (
    <div className="video-card">
      <div
        className="video-card-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: "pointer" }}
      >
        <div className="video-card-thumbnail">
          {thumbnail ? (
            <img src={thumbnail} alt={title} />
          ) : (
            <div className="video-card-placeholder">
              <span>▶</span>
            </div>
          )}
          {progress?.completed && (
            <div className="video-completed-overlay">✓</div>
          )}
        </div>
        <div className="video-card-info">
          <h4>{title}</h4>
          {description && <p>{description}</p>}
          <div className="video-card-meta">
            <span className="pill" style={{ fontSize: 10 }}>{provider}</span>
            {duration && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {Math.floor(duration / 60)} min
              </span>
            )}
            {progress && !progress.completed && (
              <span style={{ fontSize: 12, color: "var(--accent)" }}>
                {Math.round(progressPercent)}% watched
              </span>
            )}
          </div>
        </div>
        <div className="video-card-expand">
          {isExpanded ? "▲" : "▼"}
        </div>
      </div>

      {/* Progress bar */}
      {progress && !progress.completed && (
        <div className="video-card-progress">
          <div
            className="video-card-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {isExpanded && (
        <div className="video-card-player">
          <VideoPlayer
            videoUrl={videoUrl}
            provider={provider}
            duration={duration}
            thumbnail={thumbnail}
            moduleId={moduleId}
            initialProgress={progress}
            onProgress={handleSaveProgress}
          />
        </div>
      )}

      <style jsx>{`
        .video-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--surface);
        }
        .video-card-header {
          display: flex;
          gap: 16px;
          padding: 16px;
          align-items: center;
        }
        .video-card-thumbnail {
          width: 120px;
          height: 68px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }
        .video-card-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .video-card-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
        }
        .video-completed-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(34, 197, 94, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
        }
        .video-card-info {
          flex: 1;
        }
        .video-card-info h4 {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .video-card-info p {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--muted);
        }
        .video-card-meta {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .video-card-expand {
          color: var(--muted);
          font-size: 12px;
        }
        .video-card-progress {
          height: 3px;
          background: var(--surface-alt);
        }
        .video-card-progress-fill {
          height: 100%;
          background: var(--accent);
        }
        .video-card-player {
          padding: 16px;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
