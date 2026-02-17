"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoProvider } from "@prisma/client";

// Allowed domains for CUSTOM video provider (to prevent malicious URLs)
const ALLOWED_VIDEO_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "loom.com",
  "wistia.com",
  "wistia.net",
  "fast.wistia.com",
  "fast.wistia.net",
  "cloudfront.net", // AWS CloudFront (commonly used for video hosting)
  "s3.amazonaws.com", // AWS S3
  "blob.core.windows.net", // Azure Blob Storage
  "vercel-storage.com", // Vercel Blob Storage
];

/**
 * Validate video URL against allowlist of trusted domains
 * Prevents loading videos from malicious or untrusted sources
 */
function isVideoUrlAllowed(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if hostname matches any allowed domain (including subdomains)
    return ALLOWED_VIDEO_DOMAINS.some((allowedDomain) => {
      return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
    });
  } catch {
    // Invalid URL
    return false;
  }
}

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

type YoutubeState = {
  PLAYING: number;
  PAUSED: number;
  ENDED: number;
};

type YoutubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YoutubePlayer;
      PlayerState: YoutubeState;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load YouTube iframe API"));
      document.head.appendChild(script);
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    // If API loaded between checks, resolve immediately.
    if (window.YT?.Player) {
      resolve();
    }
  });

  return youtubeApiPromise;
}

function parseYouTubeId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const segments = url.pathname.split("/").filter(Boolean);
      const embedIndex = segments.indexOf("embed");
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        return segments[embedIndex + 1];
      }

      if (segments[0] === "shorts" && segments[1]) {
        return segments[1];
      }
    }
  } catch {
    // Fallback regex for malformed URL input.
  }

  const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match?.[1] ?? null;
}

function parseVimeoId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const segment = url.pathname
        .split("/")
        .filter(Boolean)
        .find((item) => /^\d+$/.test(item));
      return segment ?? null;
    }
  } catch {
    // Fallback regex below.
  }

  const match = value.match(/vimeo\.com\/(\d+)/);
  return match?.[1] ?? null;
}

export function VideoPlayer({
  videoUrl,
  provider,
  duration,
  thumbnail,
  moduleId,
  initialProgress,
  onProgress,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialProgress?.lastPosition || 0);
  const [watchedSeconds, setWatchedSeconds] = useState(initialProgress?.watchedSeconds || 0);
  const [completed, setCompleted] = useState(initialProgress?.completed || false);
  const [resolvedDuration, setResolvedDuration] = useState<number | null>(
    duration && duration > 0 ? duration : null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
  const vimeoIframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<YoutubePlayer | null>(null);

  const durationRef = useRef<number | null>(duration && duration > 0 ? duration : null);
  const progressRef = useRef({
    watchedSeconds: initialProgress?.watchedSeconds || 0,
    currentTime: initialProgress?.lastPosition || 0,
    completed: initialProgress?.completed || false,
  });
  const lastSentRef = useRef({
    watchedSeconds: initialProgress?.watchedSeconds || 0,
    currentTime: initialProgress?.lastPosition || 0,
    completed: initialProgress?.completed || false,
  });

  useEffect(() => {
    if (duration && duration > 0) {
      durationRef.current = duration;
      setResolvedDuration(duration);
    }
  }, [duration]);

  const sanitizedModuleId = useMemo(
    () => moduleId.replace(/[^a-zA-Z0-9_-]/g, ""),
    [moduleId]
  );
  const youtubeElementId = useMemo(
    () => `yt-player-${sanitizedModuleId || "module"}`,
    [sanitizedModuleId]
  );
  const vimeoPlayerId = useMemo(
    () => `vimeo-player-${sanitizedModuleId || "module"}`,
    [sanitizedModuleId]
  );

  const initialStartSeconds = useMemo(
    () => Math.max(0, Math.floor(initialProgress?.lastPosition ?? 0)),
    [initialProgress?.lastPosition]
  );

  const commitProgress = useCallback(
    (positionSeconds: number, durationSeconds?: number, forceComplete = false) => {
      const safePosition = Number.isFinite(positionSeconds)
        ? Math.max(0, Math.floor(positionSeconds))
        : 0;

      if (Number.isFinite(durationSeconds) && Number(durationSeconds) > 0) {
        const normalizedDuration = Math.floor(Number(durationSeconds));
        if (!durationRef.current || Math.abs(durationRef.current - normalizedDuration) > 1) {
          durationRef.current = normalizedDuration;
          setResolvedDuration(normalizedDuration);
        }
      }

      const previous = progressRef.current;
      const nextWatched = Math.max(previous.watchedSeconds, safePosition);
      const activeDuration = durationRef.current;
      const autoComplete =
        activeDuration && activeDuration > 0
          ? nextWatched >= Math.floor(activeDuration * 0.9)
          : false;
      const nextCompleted = previous.completed || forceComplete || autoComplete;

      progressRef.current = {
        watchedSeconds: nextWatched,
        currentTime: safePosition,
        completed: nextCompleted,
      };

      setCurrentTime(safePosition);
      if (nextWatched !== previous.watchedSeconds) {
        setWatchedSeconds(nextWatched);
      }
      if (nextCompleted !== previous.completed) {
        setCompleted(nextCompleted);
      }
    },
    []
  );

  const flushProgress = useCallback(
    (force = false) => {
      if (!onProgress) return;

      const snapshot = progressRef.current;
      const lastSent = lastSentRef.current;
      const shouldSend =
        force ||
        snapshot.completed !== lastSent.completed ||
        snapshot.watchedSeconds >= lastSent.watchedSeconds + 10 ||
        Math.abs(snapshot.currentTime - lastSent.currentTime) >= 15;

      if (!shouldSend) return;

      lastSentRef.current = { ...snapshot };
      onProgress(snapshot.watchedSeconds, snapshot.currentTime, snapshot.completed);
    },
    [onProgress]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      flushProgress(false);
    }, 12000);

    return () => window.clearInterval(interval);
  }, [flushProgress]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushProgress(true);
      }
    };
    const handlePageHide = () => flushProgress(true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      flushProgress(true);
    };
  }, [flushProgress]);

  useEffect(() => {
    if (!completed) return;
    flushProgress(true);
  }, [completed, flushProgress]);

  const embedUrl = useMemo(() => {
    if (provider === "YOUTUBE") {
      const id = parseYouTubeId(videoUrl);
      if (!id) return null;
      const params = new URLSearchParams({
        enablejsapi: "1",
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
      });
      if (typeof window !== "undefined") {
        params.set("origin", window.location.origin);
      }
      if (initialStartSeconds > 0) {
        params.set("start", String(initialStartSeconds));
      }
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    if (provider === "VIMEO") {
      const id = parseVimeoId(videoUrl);
      if (!id) return null;
      const params = new URLSearchParams({
        api: "1",
        autoplay: "0",
        dnt: "1",
        player_id: vimeoPlayerId,
      });
      return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }

    if (provider === "LOOM") {
      const match = videoUrl.match(/loom\.com\/share\/([^?]+)/);
      if (!match) return null;
      return `https://www.loom.com/embed/${match[1]}`;
    }

    return null;
  }, [provider, videoUrl, initialStartSeconds, vimeoPlayerId]);

  useEffect(() => {
    if (provider !== "YOUTUBE" || !embedUrl) return;

    let cancelled = false;
    let pollTimer: number | null = null;

    const setup = async () => {
      try {
        await loadYoutubeApi();
      } catch {
        return;
      }

      if (cancelled || !window.YT || !youtubeIframeRef.current) return;

      const player = new window.YT.Player(youtubeIframeRef.current, {
        events: {
          onReady: () => {
            if (cancelled) return;
            try {
              const playerDuration = player.getDuration();
              const playerTime = player.getCurrentTime();
              commitProgress(playerTime, playerDuration);
            } catch {
              // ignore provider runtime exceptions
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            const playerState = window.YT?.PlayerState;
            if (!playerState) return;

            if (state === playerState.PLAYING) {
              setIsPlaying(true);
            }

            if (state === playerState.PAUSED || state === playerState.ENDED) {
              setIsPlaying(false);
            }

            if (state === playerState.ENDED) {
              let playerDuration = durationRef.current || progressRef.current.currentTime;
              try {
                playerDuration = player.getDuration() || playerDuration;
              } catch {
                // ignore provider runtime exceptions
              }
              commitProgress(playerDuration, playerDuration, true);
              flushProgress(true);
            }
          },
        },
      });

      youtubePlayerRef.current = player;

      pollTimer = window.setInterval(() => {
        if (cancelled) return;
        try {
          const seconds = player.getCurrentTime();
          const playerDuration = player.getDuration();
          commitProgress(seconds, playerDuration);
        } catch {
          // ignore provider runtime exceptions
        }
      }, 1000);
    };

    setup();

    return () => {
      cancelled = true;
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch {
          // ignore provider runtime exceptions
        }
      }
      youtubePlayerRef.current = null;
    };
  }, [provider, embedUrl, commitProgress, flushProgress]);

  useEffect(() => {
    if (provider !== "VIMEO" || !embedUrl || !vimeoIframeRef.current) return;

    const iframe = vimeoIframeRef.current;
    const vimeoOrigin = "https://player.vimeo.com";

    const postToVimeo = (payload: Record<string, unknown>) => {
      iframe.contentWindow?.postMessage(JSON.stringify(payload), vimeoOrigin);
    };

    const subscribe = () => {
      postToVimeo({ method: "addEventListener", value: "play" });
      postToVimeo({ method: "addEventListener", value: "pause" });
      postToVimeo({ method: "addEventListener", value: "ended" });
      postToVimeo({ method: "addEventListener", value: "timeupdate" });
      postToVimeo({ method: "getDuration" });
    };

    const onLoad = () => {
      subscribe();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== vimeoOrigin) return;
      if (event.source !== iframe.contentWindow) return;

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== "object") return;

      const message = payload as {
        event?: string;
        method?: string;
        data?: { seconds?: number; duration?: number };
        value?: number;
      };

      if (message.event === "play") {
        setIsPlaying(true);
        return;
      }

      if (message.event === "pause") {
        setIsPlaying(false);
        return;
      }

      if (message.event === "timeupdate") {
        const seconds = Number(message.data?.seconds ?? 0);
        const playerDuration = Number(message.data?.duration ?? 0);
        commitProgress(seconds, playerDuration > 0 ? playerDuration : undefined);
        return;
      }

      if (message.event === "ended") {
        setIsPlaying(false);
        const playerDuration = Number(message.data?.duration ?? durationRef.current ?? progressRef.current.currentTime);
        commitProgress(playerDuration, playerDuration, true);
        flushProgress(true);
        return;
      }

      if (message.method === "getDuration") {
        const playerDuration = Number(message.value);
        if (Number.isFinite(playerDuration) && playerDuration > 0) {
          durationRef.current = Math.floor(playerDuration);
          setResolvedDuration(Math.floor(playerDuration));
        }
      }
    };

    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onMessage);

    const initTimer = window.setTimeout(subscribe, 500);

    return () => {
      window.clearTimeout(initTimer);
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
    };
  }, [provider, embedUrl, commitProgress, flushProgress]);

  const handleCustomTimeUpdate = () => {
    if (!videoRef.current) return;
    commitProgress(videoRef.current.currentTime, videoRef.current.duration);
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = resolvedDuration
    ? Math.min((watchedSeconds / resolvedDuration) * 100, 100)
    : 0;

  return (
    <div className="video-player-container">
      <div className="video-progress-bar">
        <div
          className="video-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="video-wrapper">
        {provider === "CUSTOM" ? (
          // Validate URL for CUSTOM provider to prevent loading malicious content
          isVideoUrlAllowed(videoUrl) ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnail}
              controls
              onTimeUpdate={handleCustomTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                const endingTime =
                  videoRef.current?.duration ?? durationRef.current ?? progressRef.current.currentTime;
                commitProgress(endingTime, endingTime, true);
                flushProgress(true);
              }}
            />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Video URL Not Allowed
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8" }}>
                This video URL is from an untrusted domain. Only videos from approved
                sources can be played.
              </div>
            </div>
          )
        ) : embedUrl ? (
          <iframe
            id={provider === "YOUTUBE" ? youtubeElementId : vimeoPlayerId}
            ref={provider === "YOUTUBE" ? youtubeIframeRef : provider === "VIMEO" ? vimeoIframeRef : undefined}
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Invalid or unsupported video URL
          </div>
        )}
      </div>

      <div className="video-info">
        <div className="video-stats">
          {resolvedDuration ? (
            <span>
              {formatTime(watchedSeconds)} / {formatTime(resolvedDuration)} watched
            </span>
          ) : (
            <span>{formatTime(currentTime)} watched</span>
          )}
          {completed && <span className="completed-badge">Completed</span>}
          {!completed && isPlaying && <span className="playing-badge">Watching</span>}
        </div>
        {!completed && resolvedDuration && (
          <span className="video-remaining">
            {formatTime(Math.max(0, resolvedDuration - watchedSeconds))} remaining
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
          padding-bottom: 56.25%;
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
        .playing-badge {
          background: rgba(20, 184, 166, 0.25);
          color: #99f6e4;
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
  progress,
}: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const progressPercent = duration && progress
    ? (progress.watchedSeconds / duration) * 100
    : 0;

  const handleSaveProgress = async () => {
    // Progress saving is handled by the parent route via VideoPlayer onProgress callback.
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
              <span>Play</span>
            </div>
          )}
          {progress?.completed && (
            <div className="video-completed-overlay">Done</div>
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
          {isExpanded ? "^" : "v"}
        </div>
      </div>

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
