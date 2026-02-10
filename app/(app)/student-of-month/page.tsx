import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentOfMonthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Sample data - in production, fetch from database
  const currentMonth = {
    id: "1",
    studentName: "Maya Rodriguez",
    studentPhoto: "👩‍🎨",
    month: "March 2024",
    chapter: "Philadelphia",
    passionAreas: ["Photography", "Service"],
    nomination: "Maya has shown exceptional dedication to her photography passion while also giving back to the community. This month alone, she logged 45 practice sessions, helped 8 students with composition techniques, and organized a free photography workshop for local middle schoolers.",
    achievements: [
      "Completed 'Advanced Photography' workshop series",
      "Published photo essay in school magazine",
      "Mentored 3 beginner photographers",
      "Logged 32 hours of practice",
      "Created before/after comparison showing 6-month growth",
      "Organized community photo walk event"
    ],
    quote: "YPP taught me that passion isn't just about getting better yourself - it's about lifting others up along the way. Photography is my way of seeing the world, and helping others discover their perspective has been the most rewarding part of this journey.",
    storyUrl: "/stories/maya-march-2024",
    photoUrl: "📸",
    celebrationCount: 156,
    announcedDate: "2024-03-01"
  };

  const pastWinners = [
    {
      id: "2",
      studentName: "Carlos Martinez",
      month: "February 2024",
      chapter: "Philadelphia",
      passionArea: "Service",
      photoUrl: "🌱",
      achievement: "Led community garden project serving 50+ families"
    },
    {
      id: "3",
      studentName: "Sarah Kim",
      month: "January 2024",
      chapter: "San Francisco",
      passionArea: "Visual Arts",
      photoUrl: "🎨",
      achievement: "Solo art exhibition at local gallery"
    },
    {
      id: "4",
      studentName: "Jake Thompson",
      month: "December 2023",
      chapter: "Boston",
      passionArea: "Music",
      photoUrl: "🎸",
      achievement: "Composed original musical score for theater production"
    },
    {
      id: "5",
      studentName: "Emma Chen",
      month: "November 2023",
      chapter: "Seattle",
      passionArea: "STEM",
      photoUrl: "💻",
      achievement: "Developed autism awareness app with 5,000+ downloads"
    },
    {
      id: "6",
      studentName: "Alex Rivera",
      month: "October 2023",
      chapter: "Austin",
      passionArea: "Public Speaking",
      photoUrl: "🎤",
      achievement: "Won state debate championship"
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Student of the Month</h1>
        </div>
        <button className="button primary">
          Nominate Student
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>⭐ Celebrating Excellence</h3>
        <p>
          Each month, we recognize one outstanding student from each chapter who exemplifies
          dedication, growth, and community spirit in their passion pursuits.
        </p>
      </div>

      {/* Current Month Winner */}
      <div className="card" style={{
        marginBottom: 40,
        background: "linear-gradient(135deg, rgba(var(--primary-rgb), 0.1) 0%, transparent 100%)",
        border: "2px solid var(--primary-color)"
      }}>
        <div style={{
          backgroundColor: "var(--primary-color)",
          color: "white",
          padding: "12px 20px",
          margin: "-20px -20px 20px -20px",
          borderRadius: "12px 12px 0 0",
          textAlign: "center",
          fontSize: 18,
          fontWeight: 700
        }}>
          🏆 {currentMonth.month} - {currentMonth.chapter} Chapter
        </div>

        <div style={{ display: "flex", gap: 24, alignItems: "start" }}>
          {/* Photo */}
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontSize: 120, marginBottom: 12 }}>
              {currentMonth.studentPhoto}
            </div>
            <div style={{ fontSize: 48 }}>
              {currentMonth.photoUrl}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 32, marginBottom: 8 }}>
              {currentMonth.studentName}
            </h2>
            <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 16 }}>
              {currentMonth.passionAreas.join(" • ")}
            </div>

            {/* Why They Won */}
            <div style={{
              backgroundColor: "white",
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid var(--border-color)"
            }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Why {currentMonth.studentName.split(' ')[0]} Won</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6 }}>
                {currentMonth.nomination}
              </p>
            </div>

            {/* Achievements This Month */}
            <div style={{
              backgroundColor: "white",
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid var(--border-color)"
            }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Achievements This Month</h3>
              <ul style={{ marginLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
                {currentMonth.achievements.map((achievement, i) => (
                  <li key={i}>{achievement}</li>
                ))}
              </ul>
            </div>

            {/* Quote */}
            <div style={{
              backgroundColor: "white",
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid var(--border-color)",
              fontStyle: "italic",
              fontSize: 15,
              lineHeight: 1.6
            }}>
              "{currentMonth.quote}"
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button className="button primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>👏</span>
                <span>Celebrate ({currentMonth.celebrationCount})</span>
              </button>
              <button className="button secondary">
                💬 Leave Congrats Message
              </button>
              <a href={currentMonth.storyUrl} className="button secondary">
                📖 Read Full Story
              </a>
              <button className="button secondary">
                📤 Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Past Winners */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Past Winners
        </div>
        <div className="grid three">
          {pastWinners.map((winner) => (
            <div key={winner.id} className="card">
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 80, marginBottom: 12 }}>
                  {winner.photoUrl}
                </div>
                <span className="pill secondary">
                  {winner.month}
                </span>
              </div>
              <h3 style={{ textAlign: "center", marginBottom: 8 }}>
                {winner.studentName}
              </h3>
              <p style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 12
              }}>
                {winner.chapter} • {winner.passionArea}
              </p>
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 12,
                minHeight: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center"
              }}>
                {winner.achievement}
              </div>
              <button className="button secondary" style={{ width: "100%", fontSize: 13 }}>
                View Full Story
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* How Nominations Work */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>How Student of the Month Works</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>1️⃣ Nominations</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Instructors, mentors, and peers can nominate students who demonstrate exceptional dedication, growth, and community spirit.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>2️⃣ Review</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Chapter leaders review nominations and select one student per chapter who best embodies YPP values.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>3️⃣ Recognition</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Winners are featured on the website, receive special badge, bonus XP, and their story inspires the community!
            </p>
          </div>
        </div>
      </div>

      {/* Nominate CTA */}
      <div className="card" style={{ marginTop: 28, textAlign: "center", padding: 40 }}>
        <h3 style={{ marginBottom: 12 }}>Know a Student Who Deserves This?</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Nominations are open to all students, instructors, and mentors.
          Help us celebrate excellence in our community!
        </p>
        <button className="button primary">
          Submit Nomination for Next Month
        </button>
      </div>
    </div>
  );
}
