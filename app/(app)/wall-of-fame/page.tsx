import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WallOfFamePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Sample data - in production, fetch from database
  const fameEntries = [
    {
      id: "1",
      studentName: "Maya Rodriguez",
      studentPhoto: "👩‍🎨",
      achievement: "Published First Photography Book",
      passionArea: "Photography",
      description: "Created and self-published 'Urban Perspectives' - a 120-page photography book featuring Philadelphia street photography. Sold 200+ copies and donated proceeds to local youth arts programs.",
      date: "2024-03-01",
      mediaUrl: "📚",
      displayOrder: 1,
      celebrationCount: 89
    },
    {
      id: "2",
      studentName: "Carlos Martinez",
      studentPhoto: "🌱",
      achievement: "Built Community Garden from Scratch",
      passionArea: "Service",
      description: "Led team of 15 students to transform vacant lot into thriving community garden. Now serves 50+ families with fresh vegetables and hosts monthly workshops.",
      date: "2024-02-15",
      mediaUrl: "🏡",
      displayOrder: 2,
      celebrationCount: 76
    },
    {
      id: "3",
      studentName: "Sarah Kim",
      studentPhoto: "🎨",
      achievement: "Solo Art Exhibition at Local Gallery",
      passionArea: "Visual Arts",
      description: "First high school student to have solo exhibition at Miller Gallery. Showcased 25 watercolor paintings with 18 pieces sold, earning $3,500.",
      date: "2024-01-20",
      mediaUrl: "🖼️",
      displayOrder: 3,
      celebrationCount: 124
    },
    {
      id: "4",
      studentName: "Jake Thompson",
      studentPhoto: "🎸",
      achievement: "Composed Original Musical Score",
      passionArea: "Music",
      description: "Wrote and produced 45-minute original musical score for local theater production of 'Romeo and Juliet.' Received standing ovation at premiere.",
      date: "2024-01-10",
      mediaUrl: "🎵",
      displayOrder: 4,
      celebrationCount: 67
    },
    {
      id: "5",
      studentName: "Emma Chen",
      studentPhoto: "💻",
      achievement: "Developed App for Autism Awareness",
      passionArea: "STEM",
      description: "Created mobile app helping autistic students navigate social situations. Downloaded 5,000+ times and featured in local news.",
      date: "2023-12-15",
      mediaUrl: "📱",
      displayOrder: 5,
      celebrationCount: 145
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Wall of Fame</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🌟 Hall of Excellence</h3>
        <p>
          Celebrating extraordinary achievements from YPP students. These outstanding
          accomplishments inspire us all to pursue our passions with dedication and excellence.
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{fameEntries.length}</div>
          <div className="kpi-label">Featured Achievements</div>
        </div>
        <div className="card">
          <div className="kpi">
            {fameEntries.reduce((sum, e) => sum + e.celebrationCount, 0)}
          </div>
          <div className="kpi-label">Total Celebrations</div>
        </div>
        <div className="card">
          <div className="kpi">12</div>
          <div className="kpi-label">Passion Areas Represented</div>
        </div>
        <div className="card">
          <div className="kpi">3</div>
          <div className="kpi-label">Your Nominations</div>
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
            <option>All Time</option>
            <option>This Year</option>
            <option>Last 6 Months</option>
            <option>This Month</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Featured</option>
            <option>Sort: Recent</option>
            <option>Sort: Most Celebrated</option>
          </select>
        </div>
      </div>

      {/* Wall of Fame Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {fameEntries.map((entry, index) => (
          <div key={entry.id} className="card" style={{
            position: "relative",
            border: index < 3 ? "2px solid var(--primary-color)" : undefined,
            background: index === 0 ? "linear-gradient(135deg, rgba(var(--primary-rgb), 0.05) 0%, transparent 100%)" : undefined
          }}>
            {/* Rank Badge */}
            {index < 3 && (
              <div style={{
                position: "absolute",
                top: -12,
                left: 20,
                backgroundColor: index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : "#CD7F32",
                color: "white",
                padding: "6px 16px",
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
              }}>
                {index === 0 ? "🥇 Featured" : index === 1 ? "🥈 Second Place" : "🥉 Third Place"}
              </div>
            )}

            <div style={{ display: "flex", gap: 20, alignItems: "start", marginTop: index < 3 ? 12 : 0 }}>
              {/* Student Photo */}
              <div style={{ fontSize: 72, flexShrink: 0 }}>
                {entry.studentPhoto}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <h2 style={{ marginBottom: 4, fontSize: 24 }}>
                      {entry.achievement}
                    </h2>
                    <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 4 }}>
                      by {entry.studentName}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      {entry.passionArea} • {new Date(entry.date).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <div style={{ fontSize: 48 }}>
                    {entry.mediaUrl}
                  </div>
                </div>

                <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16 }}>
                  {entry.description}
                </p>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button className="button secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👏</span>
                    <span>Celebrate ({entry.celebrationCount})</span>
                  </button>
                  <button className="button secondary">
                    💬 Comment
                  </button>
                  <button className="button secondary">
                    📤 Share
                  </button>
                  <button className="button secondary">
                    📖 Full Story
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Nominate Section */}
      <div className="card" style={{ marginTop: 40, textAlign: "center", padding: 40 }}>
        <h3 style={{ marginBottom: 12 }}>Know Someone Who Deserves Recognition?</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Nominate a fellow student whose achievement deserves to be celebrated on the Wall of Fame.
          Nominations are reviewed by mentors and chapter leaders.
        </p>
        <button className="button primary">
          Submit Nomination
        </button>
      </div>

      {/* Past Featured */}
      <div style={{ marginTop: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Past Featured Achievements
        </div>
        <div className="grid three">
          {[
            { student: "Alex Rivera", achievement: "State Debate Championship", passion: "Public Speaking" },
            { student: "Nina Patel", achievement: "Published Research Paper", passion: "STEM" },
            { student: "Marcus Johnson", achievement: "Nonprofit Fundraiser: $10K", passion: "Service" }
          ].map((item, i) => (
            <div key={i} className="card">
              <h4 style={{ marginBottom: 8, fontSize: 16 }}>{item.achievement}</h4>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                {item.student} • {item.passion}
              </div>
              <button className="button secondary" style={{ width: "100%", fontSize: 13 }}>
                View Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
