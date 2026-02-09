import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SuccessStoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Sample data - in production, fetch from database
  const stories = [
    {
      id: "1",
      name: "Maya Rodriguez",
      passionArea: "Photography",
      title: "From YPP Student to Professional Photographer",
      story: "Started photographing my neighborhood at 14. YPP gave me the structure to practice daily and feedback to improve. Now I'm a full-time photographer shooting for magazines and local businesses.",
      currentRole: "Professional Photographer & Photo Editor",
      advice: "Document everything. Your early work might feel rough, but it's part of your story. Also, help beginners - teaching others accelerated my own growth.",
      thumbnailUrl: "📸",
      videoUrl: "https://example.com/maya-story",
      featured: true,
      views: 2847,
      tags: ["photography", "professional", "alumni"]
    },
    {
      id: "2",
      name: "Carlos Martinez",
      passionArea: "Service",
      title: "Community Garden to Nonprofit Organization",
      story: "What started as a YPP project turned into a registered nonprofit. We now have 5 community gardens serving 200+ families. YPP taught me project management and persistence.",
      currentRole: "Founder & Executive Director, Green Roots Initiative",
      advice: "Start small, but think big. My first garden was just 3 plots. Document your impact with photos and numbers - it helps with fundraising and keeps you motivated.",
      thumbnailUrl: "🌱",
      videoUrl: "https://example.com/carlos-story",
      featured: true,
      views: 1923,
      tags: ["service", "nonprofit", "alumni"]
    },
    {
      id: "3",
      name: "Sarah Kim",
      passionArea: "Visual Arts",
      title: "Art School Scholarship Success",
      story: "Built my entire college portfolio through YPP. The timeline feature helped me track improvement, and showcase events gave me presentation experience. Full scholarship to RISD!",
      currentRole: "Illustration Student at Rhode Island School of Design",
      advice: "Save everything - even your 'bad' work. Colleges want to see growth, not perfection. And practice explaining your process out loud.",
      thumbnailUrl: "🎨",
      videoUrl: null,
      featured: false,
      views: 1456,
      tags: ["visual-arts", "college", "current-student"]
    },
    {
      id: "4",
      name: "Jake Thompson",
      passionArea: "Music",
      title: "YouTube Channel to Record Label",
      story: "Started posting my guitar covers on YouTube at 15. YPP's practice tracking kept me consistent. Hit 100K subscribers, now signed with an indie label producing original music.",
      currentRole: "Signed Musician & Content Creator",
      advice: "Consistency beats talent. Post weekly, even if it's not perfect. Also, engage with your community - my fans became my accountability partners.",
      thumbnailUrl: "🎸",
      videoUrl: "https://example.com/jake-story",
      featured: false,
      views: 3201,
      tags: ["music", "youtube", "alumni"]
    },
    {
      id: "5",
      name: "Emma Chen",
      passionArea: "STEM",
      title: "App Development to Tech Internship",
      story: "Built an autism awareness app through YPP project tracker. Featured in local news, caught attention of tech company. Landed internship at 16, now studying CS at MIT.",
      currentRole: "Computer Science Student at MIT",
      advice: "Don't wait for permission. If you have an idea, start building. YPP gave me the structure to actually finish what I started.",
      thumbnailUrl: "💻",
      videoUrl: "https://example.com/emma-story",
      featured: false,
      views: 2134,
      tags: ["stem", "app-development", "college"]
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Inspiration</p>
          <h1 className="page-title">Success Stories</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🌟 You Can Do It Too</h3>
        <p>
          Real stories from YPP students and alumni who turned their passions into careers,
          college opportunities, and community impact. If they can do it, so can you!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{stories.length}</div>
          <div className="kpi-label">Success Stories</div>
        </div>
        <div className="card">
          <div className="kpi">{stories.reduce((sum, s) => sum + s.views, 0).toLocaleString()}</div>
          <div className="kpi-label">Total Views</div>
        </div>
        <div className="card">
          <div className="kpi">12</div>
          <div className="kpi-label">Passion Areas</div>
        </div>
        <div className="card">
          <div className="kpi">{stories.filter(s => s.featured).length}</div>
          <div className="kpi-label">Featured Stories</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Music</option>
            <option>Service</option>
            <option>STEM</option>
            <option>Photography</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Stories</option>
            <option>Alumni</option>
            <option>Current Students</option>
            <option>Featured</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Featured</option>
            <option>Sort: Most Viewed</option>
            <option>Sort: Recent</option>
          </select>
        </div>
      </div>

      {/* Featured Stories */}
      <div style={{ marginBottom: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Featured Stories
        </div>
        <div className="grid two">
          {stories.filter(s => s.featured).map((story) => (
            <div key={story.id} className="card">
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 12,
                padding: 60,
                textAlign: "center",
                marginBottom: 16,
                fontSize: 80
              }}>
                {story.thumbnailUrl}
                {story.videoUrl && (
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: 48,
                    opacity: 0.9
                  }}>
                    ▶️
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span className="pill success">Featured</span>
                <span className="pill secondary" style={{ marginLeft: 8 }}>
                  {story.passionArea}
                </span>
              </div>
              <h3 style={{ marginBottom: 8 }}>{story.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                {story.name} • {story.currentRole}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                {story.story}
              </p>
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
                fontStyle: "italic"
              }}>
                <strong>Advice:</strong> "{story.advice}"
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                <span>👁️ {story.views.toLocaleString()} views</span>
              </div>
              {story.videoUrl ? (
                <a href={story.videoUrl} target="_blank" className="button primary" style={{ width: "100%" }}>
                  ▶️ Watch Video Story
                </a>
              ) : (
                <button className="button secondary" style={{ width: "100%" }}>
                  📖 Read Full Story
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All Stories */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          More Success Stories
        </div>
        <div className="grid three">
          {stories.filter(s => !s.featured).map((story) => (
            <div key={story.id} className="card">
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                marginBottom: 12,
                fontSize: 64
              }}>
                {story.thumbnailUrl}
              </div>
              <span className="pill secondary" style={{ marginBottom: 8 }}>
                {story.passionArea}
              </span>
              <h4 style={{ marginBottom: 8, fontSize: 16 }}>{story.title}</h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                {story.name}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                {story.story.substring(0, 100)}...
              </p>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                👁️ {story.views.toLocaleString()} views
              </div>
              {story.videoUrl ? (
                <a href={story.videoUrl} target="_blank" className="button secondary" style={{ width: "100%", fontSize: 13 }}>
                  ▶️ Watch
                </a>
              ) : (
                <button className="button secondary" style={{ width: "100%", fontSize: 13 }}>
                  Read More
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Share Your Story CTA */}
      <div className="card" style={{ marginTop: 40, textAlign: "center", padding: 40 }}>
        <h3 style={{ marginBottom: 12 }}>Have a Success Story to Share?</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Inspire the next generation! If you've achieved something meaningful through
          your passion, we'd love to feature your story.
        </p>
        <button className="button primary">
          Submit Your Story
        </button>
      </div>
    </div>
  );
}
