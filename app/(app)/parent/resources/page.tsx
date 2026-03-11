import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

const RESOURCE_CATEGORIES = [
  {
    icon: "🎓",
    title: "College Prep & Passion Portfolios",
    description:
      "How to help your student turn their passion into a compelling college application — documenting projects, awards, and growth over time.",
    topics: ["Building a passion portfolio", "Writing about passion in essays", "Choosing programs that align with interests", "Connecting passion to career paths"],
  },
  {
    icon: "🧠",
    title: "Mental Health & Wellbeing",
    description:
      "Recognizing burnout, supporting healthy practice habits, and knowing when to push versus when to step back.",
    topics: ["Signs of passion burnout", "Balancing academics and passion pursuits", "Building resilience after setbacks", "When to seek extra support"],
  },
  {
    icon: "💬",
    title: "Supporting Your Teen's Passion",
    description:
      "Practical ways to be a meaningful supporter — without taking over, creating pressure, or unintentionally undermining your student's intrinsic motivation.",
    topics: ["How to give encouraging feedback", "Avoiding helicopter support", "Understanding the YPP program structure", "How to ask your student about progress"],
  },
  {
    icon: "💰",
    title: "Financial Aid & Scholarships",
    description:
      "Understanding how passion-based achievements factor into financial aid, scholarship applications, and opportunities that recognize unconventional excellence.",
    topics: ["Passion-focused scholarships", "Documenting achievements for FAFSA context", "Local and national opportunities", "YPP recognition and its value on applications"],
  },
  {
    icon: "🤝",
    title: "Navigating the YPP Program",
    description:
      "Everything a parent needs to know about how the program works — roles, expectations, communication channels, and how to stay involved appropriately.",
    topics: ["Program structure and phases", "What instructors and mentors do", "Parent communication norms", "How to raise concerns constructively"],
  },
  {
    icon: "🌱",
    title: "Long-Term Passion Development",
    description:
      "How to think about passion as a lifelong practice, not just a high school activity — and what that means for your family's long-term support strategy.",
    topics: ["Passion vs. hobby vs. career", "How interests evolve over time", "Celebrating progress over outcomes", "Supporting pivots and changes in direction"],
  },
];

export default async function ParentResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Resources for Parents</h1>
          <p className="page-subtitle">
            Curated guides to help you understand, support, and celebrate your student&apos;s passion journey.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 32, padding: "24px 28px", borderLeft: "4px solid var(--primary-color)" }}>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          The YPP team is building out a full resource library for parents — articles, guides, videos,
          and Q&amp;As curated specifically for families supporting students in passion-based learning.
          In the meantime, here are the categories that will be covered, along with the topics each
          section will address.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
        {RESOURCE_CATEGORIES.map((category) => (
          <div key={category.title} className="card">
            <div style={{ fontSize: 36, marginBottom: 12 }}>{category.icon}</div>
            <h3 style={{ marginBottom: 8 }}>{category.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
              {category.description}
            </p>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Topics covered
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                {category.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
