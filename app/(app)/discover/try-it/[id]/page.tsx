import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTryItSessionById } from "@/lib/discovery-actions";

function toEmbedUrl(url: string): string {
  if (!url) return url;
  const youtubeWatch = "youtube.com/watch?v=";
  if (url.includes(youtubeWatch)) {
    const videoId = url.split("v=")[1]?.split("&")[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1]?.split("?")[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

export default async function TryItSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tryIt = await getTryItSessionById(params.id);

  if (!tryIt) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Try-It Session Not Found</h1>
          </div>
          <Link href="/discover/try-it" className="button secondary">
            Back to Try-It
          </Link>
        </div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            This session does not exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const embedUrl = toEmbedUrl(tryIt.videoUrl);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/discover/try-it" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Back to Try-It Sessions
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{tryIt.title}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {tryIt.passionName} · {tryIt.duration} minutes
          </p>
        </div>
        <Link href="/world" className="button secondary">
          Passion World
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>{tryIt.description}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
          <iframe
            src={embedUrl}
            title={tryIt.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Session Details</h3>
        {tryIt.presenter && (
          <p style={{ marginBottom: 8 }}>
            <strong>Presenter:</strong> {tryIt.presenter}
          </p>
        )}
        {tryIt.materialsNeeded && (
          <p style={{ marginBottom: 12 }}>
            <strong>Materials:</strong> {tryIt.materialsNeeded}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/activities" className="button primary">
            Find More Activities
          </Link>
          <Link href="/challenges" className="button secondary">
            Try Challenges
          </Link>
        </div>
      </div>
    </div>
  );
}
