"use client";

import { useState } from "react";

export default function PortfolioBuilderPage() {
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);

  // Sample data - in production, fetch from database
  const portfolioSections = [
    {
      id: "1",
      title: "Visual Arts",
      description: "My landscape painting portfolio",
      displayOrder: 1,
      isVisible: true,
      items: [
        {
          id: "1",
          title: "Mountain Sunset Series",
          type: "IMAGE",
          description: "Watercolor landscape series exploring light and atmosphere in mountain environments. Completed over 3 months.",
          mediaUrl: "https://example.com/mountain-sunset.jpg",
          thumbnailUrl: "https://example.com/thumb-mountain.jpg",
          tags: ["watercolor", "landscape", "mountains"],
          completedAt: "2024-03-01",
          displayOrder: 1,
          achievements: "Featured in Spring Showcase 2024, Awarded 'Best Composition'"
        },
        {
          id: "2",
          title: "Urban Sketches",
          type: "IMAGE",
          description: "Collection of quick sketches capturing Philadelphia's architecture and street scenes.",
          mediaUrl: "https://example.com/urban-sketches.pdf",
          thumbnailUrl: "https://example.com/thumb-urban.jpg",
          tags: ["sketching", "urban", "ink"],
          completedAt: "2024-02-15",
          displayOrder: 2,
          achievements: null
        }
      ]
    },
    {
      id: "2",
      title: "Music Compositions",
      description: "Original songs and instrumental pieces",
      displayOrder: 2,
      isVisible: true,
      items: [
        {
          id: "3",
          title: "Finding Home (Original Song)",
          type: "AUDIO",
          description: "Singer-songwriter piece about identity and belonging. Self-recorded demo.",
          mediaUrl: "https://soundcloud.com/finding-home",
          thumbnailUrl: null,
          tags: ["original", "singer-songwriter", "acoustic"],
          completedAt: "2024-03-10",
          displayOrder: 1,
          achievements: "Performed at Chapter Showcase, 500+ SoundCloud plays"
        }
      ]
    },
    {
      id: "3",
      title: "Photography",
      description: "Portrait and nature photography projects",
      displayOrder: 3,
      isVisible: false,
      items: []
    }
  ];

  const itemTypeIcons: Record<string, string> = {
    IMAGE: "🖼️",
    VIDEO: "🎥",
    AUDIO: "🎵",
    DOCUMENT: "📄",
    LINK: "🔗"
  };

  const totalItems = portfolioSections.reduce((sum, section) => sum + section.items.length, 0);
  const publicUrl = `ypp-portal.org/portfolio/sarah-chen`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Showcase</p>
          <h1 className="page-title">Portfolio Builder</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowAddItemForm(true)} className="button primary">
            Add Item
          </button>
          <button className="button secondary">
            Preview Portfolio
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📁 Build Your Portfolio</h3>
        <p>
          Create a professional portfolio showcasing your best work. Perfect for college applications,
          scholarships, competitions, or sharing with family and friends. Organize projects by passion
          area and highlight your growth over time.
        </p>
      </div>

      {/* Portfolio Settings */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ marginBottom: 8 }}>Portfolio Settings</h3>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {isPublic ? (
                <>
                  🌐 Public • Shareable at: <a href={`https://${publicUrl}`} target="_blank" style={{ color: "var(--primary-color)" }}>{publicUrl}</a>
                </>
              ) : (
                "🔒 Private • Only visible to you"
              )}
            </div>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="button secondary"
          >
            {isPublic ? "Make Private" : "Make Public"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Total Items</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{totalItems}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Sections</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{portfolioSections.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Visible Sections</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{portfolioSections.filter(s => s.isVisible).length}</div>
          </div>
        </div>
      </div>

      {/* Portfolio Sections */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="section-title">Portfolio Sections</div>
          <button className="button secondary" style={{ fontSize: 14 }}>
            + Add Section
          </button>
        </div>

        {portfolioSections.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {portfolioSections.map((section) => (
              <div key={section.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 4 }}>{section.title}</h3>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {section.description}
                    </p>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {section.items.length} item{section.items.length !== 1 ? "s" : ""} • {section.isVisible ? "Visible" : "Hidden"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="button secondary" style={{ fontSize: 13, padding: "6px 12px" }}>
                      Edit
                    </button>
                    <button className="button secondary" style={{ fontSize: 13, padding: "6px 12px" }}>
                      {section.isVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Section Items */}
                {section.items.length > 0 ? (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-color)"
                  }}>
                    {section.items.map((item) => (
                      <div key={item.id} style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                        overflow: "hidden",
                        transition: "transform 0.2s",
                        cursor: "pointer"
                      }}>
                        {item.thumbnailUrl && (
                          <div style={{
                            width: "100%",
                            height: 160,
                            backgroundColor: "var(--bg-secondary)",
                            backgroundImage: `url(${item.thumbnailUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                          }} />
                        )}
                        <div style={{ padding: 12 }}>
                          <div style={{ display: "flex", alignItems: "start", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 20 }}>{itemTypeIcons[item.type]}</span>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: 14, marginBottom: 4 }}>{item.title}</h4>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                {new Date(item.completedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8, color: "var(--text-secondary)" }}>
                            {item.description.length > 80 ? item.description.substring(0, 80) + "..." : item.description}
                          </p>
                          {item.achievements && (
                            <div style={{
                              fontSize: 12,
                              padding: "6px 10px",
                              backgroundColor: "rgba(16, 185, 129, 0.1)",
                              color: "#10b981",
                              borderRadius: 6,
                              marginBottom: 8
                            }}>
                              🏆 {item.achievements}
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {item.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="pill" style={{ fontSize: 11 }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="button secondary" style={{ fontSize: 12, padding: "4px 10px", flex: 1 }}>
                              Edit
                            </button>
                            <button className="button secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: 24,
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 8,
                    marginTop: 16,
                    fontSize: 14,
                    color: "var(--text-secondary)"
                  }}>
                    No items in this section yet. Add your first project!
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📁</div>
            <h3 style={{ marginBottom: 12 }}>No Portfolio Sections Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Create sections to organize your work by passion area or project type
            </p>
            <button className="button primary">
              Create Your First Section
            </button>
          </div>
        )}
      </div>

      {/* Add Item Form Modal */}
      {showAddItemForm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3>Add Portfolio Item</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Add your best work to your portfolio. Include descriptions and context to help viewers understand your growth.
            </p>
            <form action="/api/portfolio/items/create" method="POST">
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Section *
                </label>
                <select
                  name="sectionId"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">Select section</option>
                  {portfolioSections.map(section => (
                    <option key={section.id} value={section.id}>{section.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Item Type *
                </label>
                <select
                  name="type"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">Select type</option>
                  <option value="IMAGE">🖼️ Image/Gallery</option>
                  <option value="VIDEO">🎥 Video</option>
                  <option value="AUDIO">🎵 Audio</option>
                  <option value="DOCUMENT">📄 Document/PDF</option>
                  <option value="LINK">🔗 External Link</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Mountain Landscape Series"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="Describe the project, your process, what you learned, techniques used..."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Media URL *
                </label>
                <input
                  type="url"
                  name="mediaUrl"
                  required
                  placeholder="Link to your work (Google Drive, YouTube, SoundCloud, etc.)"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Share a public link to your work
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Thumbnail URL (optional)
                </label>
                <input
                  type="url"
                  name="thumbnailUrl"
                  placeholder="Preview image URL"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Tags
                </label>
                <input
                  type="text"
                  name="tags"
                  placeholder="watercolor, landscape, mountains (comma-separated)"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Achievements (optional)
                </label>
                <input
                  type="text"
                  name="achievements"
                  placeholder="e.g., Featured in Spring Showcase, Won Best Composition Award"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Completion Date
                </label>
                <input
                  type="date"
                  name="completedAt"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Add to Portfolio
                </button>
                <button type="button" onClick={() => setShowAddItemForm(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portfolio Tips */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>💡 Portfolio Tips</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Quality Over Quantity</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Show your 5-10 best pieces rather than everything you've made
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Show Your Process</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Include drafts, sketches, or behind-the-scenes to demonstrate your growth
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Tell the Story</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Explain what inspired you, what challenges you faced, what you learned
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Keep It Updated</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Replace older work as you improve. Your portfolio should represent your current skill level
            </p>
          </div>
        </div>
      </div>

      {/* College Application Note */}
      <div className="card" style={{ marginTop: 20, backgroundColor: "rgba(var(--primary-rgb), 0.05)", border: "1px solid var(--primary-color)" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
          <div style={{ fontSize: 40 }}>🎓</div>
          <div>
            <h4 style={{ marginBottom: 8 }}>Using Your Portfolio for College Applications</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Your YPP portfolio can be submitted as supplemental material for college applications.
              Many admissions officers value seeing authentic passion projects. Make sure to set your
              portfolio to public and include the link in your application materials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
