"use client";

import { useState } from "react";

export default function ParentResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  // Sample data - in production, fetch from database
  const categories = [
    { id: "SUPPORTING_PASSION", label: "Supporting Their Passion", icon: "❤️", count: 12 },
    { id: "COLLEGE_PREP", label: "College Preparation", icon: "🎓", count: 8 },
    { id: "MENTAL_HEALTH", label: "Mental Health & Wellbeing", icon: "🧠", count: 6 },
    { id: "YOUTH_DEVELOPMENT", label: "Youth Development", icon: "🌱", count: 10 },
    { id: "SCHOLARSHIPS", label: "Scholarships & Funding", icon: "💰", count: 7 },
    { id: "TIME_MANAGEMENT", label: "Time Management", icon: "⏰", count: 5 },
    { id: "PARENT_INVOLVEMENT", label: "Parent Involvement", icon: "👨‍👩‍👧", count: 9 },
    { id: "SUCCESS_STORIES", label: "Success Stories", icon: "⭐", count: 15 }
  ];

  const resources = [
    {
      id: "1",
      title: "How to Support Your Teen's Creative Passion Without Pushing Too Hard",
      description: "Learn the balance between encouragement and pressure. Discover techniques for supporting your student's passion journey while respecting their autonomy and preventing burnout.",
      category: "SUPPORTING_PASSION",
      ageGroup: ["Middle School", "High School"],
      tags: ["encouragement", "boundaries", "motivation"],
      featured: true,
      readTime: "8 min read",
      author: "Dr. Maria Rodriguez, Youth Development Specialist",
      publishedAt: "2024-03-01"
    },
    {
      id: "2",
      title: "Understanding Passion vs. Career: What Parents Need to Know",
      description: "Not every passion needs to become a career. Explore how passions contribute to wellbeing, college applications, and life satisfaction even when they remain hobbies.",
      category: "SUPPORTING_PASSION",
      ageGroup: ["High School"],
      tags: ["career", "expectations", "purpose"],
      featured: true,
      readTime: "10 min read",
      author: "College Advisor Team",
      publishedAt: "2024-02-20"
    },
    {
      id: "3",
      title: "Building a Passion-Centered College Application",
      description: "Comprehensive guide to showcasing your student's passion projects on college applications. Includes portfolio tips, essay strategies, and examples from accepted students.",
      category: "COLLEGE_PREP",
      ageGroup: ["High School"],
      tags: ["college applications", "portfolio", "essays"],
      featured: true,
      readTime: "15 min read",
      author: "Sarah Kim, Former Admissions Officer",
      publishedAt: "2024-02-15"
    },
    {
      id: "4",
      title: "When Your Teen Wants to Quit: Recognizing Healthy vs. Unhealthy Disengagement",
      description: "How to tell if your student needs a break, needs support, or genuinely wants to pivot to a new passion. Includes conversation starters and warning signs.",
      category: "MENTAL_HEALTH",
      ageGroup: ["Middle School", "High School"],
      tags: ["burnout", "quitting", "pivoting"],
      featured: false,
      readTime: "7 min read",
      author: "Dr. James Chen, Clinical Psychologist",
      publishedAt: "2024-03-05"
    },
    {
      id: "5",
      title: "Scholarships for Passion-Driven Students: Beyond Academic Merit",
      description: "Curated list of scholarships that value passion projects, community impact, and creative portfolios. Includes application tips and success stories.",
      category: "SCHOLARSHIPS",
      ageGroup: ["High School"],
      tags: ["scholarships", "funding", "applications"],
      featured: true,
      readTime: "12 min read",
      author: "YPP Financial Aid Team",
      publishedAt: "2024-01-30"
    }
  ];

  const filteredResources = selectedCategory
    ? resources.filter(r => r.category === selectedCategory)
    : resources.filter(r => r.featured);

  const currentResource = resources.find(r => r.id === selectedResource);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Resources for Parents</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📚 Expert Guidance for Supporting Your Student</h3>
        <p>
          Curated articles, guides, and resources to help you understand and support your student's
          passion journey. From college applications to mental health, these expert-written resources
          provide practical advice for parents and guardians.
        </p>
      </div>

      {!selectedResource ? (
        <>
          {/* Category Filters */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 16 }}>Browse by Topic</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? "pill" : "button secondary"}
                style={{
                  backgroundColor: selectedCategory === null ? "var(--primary-color)" : undefined,
                  color: selectedCategory === null ? "white" : undefined,
                  border: selectedCategory === null ? "none" : undefined,
                  padding: "8px 16px"
                }}
              >
                Featured
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "pill" : "button secondary"}
                  style={{
                    backgroundColor: selectedCategory === category.id ? "var(--primary-color)" : undefined,
                    color: selectedCategory === category.id ? "white" : undefined,
                    border: selectedCategory === category.id ? "none" : undefined,
                    padding: "8px 16px"
                  }}
                >
                  {category.icon} {category.label} ({category.count})
                </button>
              ))}
            </div>
          </div>

          {/* Resource Grid */}
          <div>
            <h3 style={{ marginBottom: 16 }}>
              {selectedCategory ? categories.find(c => c.id === selectedCategory)?.label : "Featured Resources"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
              {filteredResources.map((resource) => (
                <div
                  key={resource.id}
                  className="card"
                  style={{ cursor: "pointer", transition: "all 0.2s" }}
                  onClick={() => setSelectedResource(resource.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {resource.featured && (
                    <div style={{
                      display: "inline-block",
                      backgroundColor: "#f59e0b",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 12
                    }}>
                      FEATURED
                    </div>
                  )}
                  <h4 style={{ marginBottom: 12, lineHeight: 1.4 }}>{resource.title}</h4>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                    {resource.description}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {resource.tags.map((tag, i) => (
                      <span key={i} className="pill" style={{ fontSize: 11 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ 
                    paddingTop: 12, 
                    borderTop: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    color: "var(--text-secondary)"
                  }}>
                    <span>⏱️ {resource.readTime}</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="card" style={{ marginTop: 40 }}>
            <h3 style={{ marginBottom: 16 }}>Helpful Links</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              <a href="#" className="button secondary" style={{ textAlign: "left" }}>
                🔔 Subscribe to Parent Newsletter
              </a>
              <a href="#" className="button secondary" style={{ textAlign: "left" }}>
                📅 Parent Events Calendar
              </a>
              <a href="#" className="button secondary" style={{ textAlign: "left" }}>
                💬 Join Parent Discussion Forum
              </a>
              <a href="#" className="button secondary" style={{ textAlign: "left" }}>
                ❓ Contact Parent Support
              </a>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Full Resource View */}
          <button
            onClick={() => setSelectedResource(null)}
            className="button secondary"
            style={{ marginBottom: 20 }}
          >
            ← Back to Resources
          </button>

          <div className="card" style={{ maxWidth: 800, margin: "0 auto" }}>
            {currentResource?.featured && (
              <div style={{
                display: "inline-block",
                backgroundColor: "#f59e0b",
                color: "white",
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16
              }}>
                FEATURED RESOURCE
              </div>
            )}

            <h1 style={{ fontSize: 28, marginBottom: 16, lineHeight: 1.3 }}>
              {currentResource?.title}
            </h1>

            <div style={{ 
              display: "flex", 
              gap: 16, 
              paddingBottom: 20, 
              marginBottom: 24,
              borderBottom: "2px solid var(--border-color)",
              flexWrap: "wrap",
              fontSize: 14,
              color: "var(--text-secondary)"
            }}>
              <span>📝 By {currentResource?.author}</span>
              <span>•</span>
              <span>📅 {new Date(currentResource?.publishedAt!).toLocaleDateString()}</span>
              <span>•</span>
              <span>⏱️ {currentResource?.readTime}</span>
            </div>

            <div style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 32 }}>
              <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.6, marginBottom: 24 }}>
                {currentResource?.description}
              </p>

              {/* Placeholder content - in production, would load full article */}
              <h3 style={{ marginTop: 32, marginBottom: 16 }}>Introduction</h3>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt 
                ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco 
                laboris nisi ut aliquip ex ea commodo consequat.
              </p>

              <h3 style={{ marginTop: 32, marginBottom: 16 }}>Key Points to Remember</h3>
              <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
                <li>Every student's passion journey is unique and unfolds at their own pace</li>
                <li>Support looks different for different students - observe and adapt your approach</li>
                <li>Celebrate effort and growth, not just outcomes and achievements</li>
                <li>Create space for exploration without judgment or expectation</li>
              </ul>

              <div style={{
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                border: "1px solid #6366f1",
                borderRadius: 8,
                padding: 20,
                marginTop: 32,
                marginBottom: 32
              }}>
                <h4 style={{ marginBottom: 12 }}>💡 Pro Tip</h4>
                <p style={{ margin: 0 }}>
                  Ask your student to show you their portfolio or recent work, but frame it as "I'd love to 
                  see what you're working on" rather than "Show me what you accomplished." This shifts focus 
                  from performance to process.
                </p>
              </div>

              <h3 style={{ marginTop: 32, marginBottom: 16 }}>Next Steps</h3>
              <p>
                Ready to put these insights into practice? Start by having a conversation with your student 
                about their current passion projects. Use open-ended questions and practice active listening.
              </p>
            </div>

            <div style={{ 
              paddingTop: 24, 
              borderTop: "2px solid var(--border-color)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap"
            }}>
              {currentResource?.tags.map((tag, i) => (
                <span key={i} className="pill">
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 32, textAlign: "center" }}>
              <button className="button secondary">
                📧 Email This Resource
              </button>
              <button className="button secondary" style={{ marginLeft: 12 }}>
                🔖 Save for Later
              </button>
            </div>
          </div>

          {/* Related Resources */}
          <div style={{ maxWidth: 800, margin: "40px auto 0" }}>
            <h3 style={{ marginBottom: 16 }}>Related Resources</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              {resources.filter(r => r.id !== currentResource?.id && r.category === currentResource?.category).slice(0, 3).map((related) => (
                <div
                  key={related.id}
                  className="card"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedResource(related.id)}
                >
                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>{related.title}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {related.readTime} →
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
