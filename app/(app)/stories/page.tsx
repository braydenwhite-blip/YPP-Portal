import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

export default async function SuccessStoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const stories = await prisma.successStory.findMany({
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  if (stories.length === 0) {
    return (
      <EmptyState
        icon="🌟"
        badge="Inspiration"
        title="Success Stories"
        description="This page will feature real stories from YPP students and alumni who turned their passions into careers, college opportunities, and community impact."
        addedBy="admins (stories are published by the YPP team)"
        actionLabel="Go to Admin Panel"
        actionHref="/admin"
      />
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Inspiration</p>
          <h1 className="page-title">Success Stories</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
        {stories.map((story) => (
          <div key={story.id} className="card">
            {story.featured && (
              <div style={{ display: "inline-block", backgroundColor: "#f59e0b", color: "white", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
                FEATURED
              </div>
            )}
            <h3 style={{ marginBottom: 8 }}>{story.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
              {story.name}{story.currentRole && ` · ${story.currentRole}`}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              {story.story.length > 200 ? story.story.substring(0, 200) + "..." : story.story}
            </p>
            {story.advice && (
              <div style={{ backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 8, fontSize: 14, fontStyle: "italic" }}>
                <strong>Advice:</strong> &quot;{story.advice}&quot;
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>
              👁️ {story.views.toLocaleString()} views
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
