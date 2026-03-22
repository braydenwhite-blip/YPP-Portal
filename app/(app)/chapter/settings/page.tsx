import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterSettings } from "@/lib/chapter-settings-actions";
import { getJoinRequests } from "@/lib/chapter-join-actions";
import { ChapterSettingsForm } from "./chapter-settings-form";
import { JoinRequestsPanel } from "./join-requests-panel";

export default async function ChapterSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [settings, joinRequests] = await Promise.all([
    getChapterSettings(),
    getJoinRequests(),
  ]);

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Settings</h1>
          <p className="subtitle">Customize your chapter&apos;s identity and join policy</p>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <ChapterSettingsForm settings={settings} />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Preview Card */}
          <div className="card">
            <h3>Chapter Preview</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
              This is how your chapter appears in the directory
            </p>
            <div
              style={{
                marginTop: 16,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              {settings.bannerUrl && (
                <div style={{ height: 120, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bannerUrl}
                    alt="Banner"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {settings.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
                    />
                  )}
                  <div>
                    <strong>{settings.name}</strong>
                    {settings.tagline && (
                      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                        {settings.tagline}
                      </p>
                    )}
                  </div>
                </div>
                {settings.city && (
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
                    {settings.city}{settings.region ? `, ${settings.region}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Join Requests */}
          {joinRequests.length > 0 && (
            <JoinRequestsPanel requests={joinRequests} />
          )}
        </div>
      </div>
    </main>
  );
}
