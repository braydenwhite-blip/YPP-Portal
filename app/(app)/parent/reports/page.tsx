"use client";

import { useState } from "react";

export default function ParentReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Sample data - in production, fetch from database
  const reports = [
    {
      id: "1",
      studentName: "Sarah Chen",
      periodStart: "2024-03-01",
      periodEnd: "2024-03-31",
      reportType: "MONTHLY",
      totalXPEarned: 450,
      passionsActive: 3,
      hoursLogged: 48.5,
      projectsCompleted: 2,
      highlights: "Sarah has made exceptional progress in Visual Arts this month! She completed her Mountain Sunset Series, a 5-painting watercolor portfolio that demonstrates significant growth in composition and color theory. Her work was selected for the Spring Showcase where she'll present to parents and community members. Additionally, she began exploring Photography and has shown natural aptitude for visual composition.",
      areasOfGrowth: "Sarah is developing strong time management skills, consistently logging practice sessions even during busy school weeks. Her technical watercolor techniques have improved dramatically - particularly her understanding of light, shadow, and atmospheric perspective. She's also learning to accept constructive criticism gracefully and apply feedback to improve her work.",
      recommendations: "Encourage Sarah to continue building her portfolio with diverse subjects beyond landscapes. Consider supporting her interest in Photography by exploring local photography clubs or competitions. She would benefit from visiting art museums to study professional works in person. Her instructor also recommends she start documenting her creative process through photos or journaling to strengthen her college application portfolio.",
      instructorNotes: "Sarah is a joy to teach. She approaches every project with enthusiasm and genuine curiosity. Her questions in class demonstrate critical thinking about artistic choices. I'm confident she has the dedication and talent to pursue Visual Arts at the collegiate level. - Ms. Chen, Visual Arts Instructor",
      showcaseItems: [
        "Mountain Sunset Series (5 paintings)",
        "Urban Sketches Collection",
        "Photography exploration: Portrait series (in progress)"
      ],
      generatedAt: "2024-04-01",
      sentAt: "2024-04-01"
    },
    {
      id: "2",
      studentName: "Sarah Chen",
      periodStart: "2024-02-01",
      periodEnd: "2024-02-29",
      reportType: "MONTHLY",
      totalXPEarned: 380,
      passionsActive: 2,
      hoursLogged: 42.0,
      projectsCompleted: 1,
      highlights: "Sarah maintained strong engagement this month despite midterm exams. She completed the 'Finding Your Style' workshop series and began work on her Mountain Sunset portfolio project. She earned the 'Consistent Creator' badge for logging practice 20 days in a row.",
      areasOfGrowth: "Improving her understanding of color mixing and developing her personal artistic style. Learning to balance schoolwork with passion projects effectively.",
      recommendations: "Continue daily practice habits. Start researching art school portfolio requirements to align upcoming projects with admission standards.",
      instructorNotes: "Sarah shows great promise. Her dedication sets a positive example for other students.",
      showcaseItems: [
        "Style exploration sketches",
        "Color theory practice sheets"
      ],
      generatedAt: "2024-03-01",
      sentAt: "2024-03-01"
    },
    {
      id: "3",
      studentName: "Sarah Chen",
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
      reportType: "MONTHLY",
      totalXPEarned: 320,
      passionsActive: 2,
      hoursLogged: 35.5,
      projectsCompleted: 1,
      highlights: "Great start to the new year! Sarah completed the Passion Discovery Quiz and confirmed Visual Arts as her primary passion. She also began exploring Writing as a secondary interest. Completed first project: 'Local Landmarks' sketch series.",
      areasOfGrowth: "Building confidence in sharing work publicly and accepting peer feedback.",
      recommendations: "Encourage participation in the Spring Showcase. Consider joining a study group for peer support.",
      instructorNotes: "Sarah has natural talent and strong work ethic. Excited to see her growth this year!",
      showcaseItems: [
        "Local Landmarks sketch series"
      ],
      generatedAt: "2024-02-01",
      sentAt: "2024-02-01"
    }
  ];

  const currentReport = reports.find(r => r.id === selectedReport);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Progress Reports</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {selectedReport && (
            <>
              <button className="button secondary">
                📧 Email Report
              </button>
              <button className="button secondary">
                📥 Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📊 Track Your Student's Growth</h3>
        <p>
          Detailed progress reports generated monthly by instructors. Each report includes achievements,
          areas of growth, instructor observations, and recommendations for supporting your student's
          passion journey at home.
        </p>
      </div>

      {!selectedReport ? (
        <>
          {/* Report Archive */}
          <div>
            <h3 style={{ marginBottom: 16 }}>Report Archive</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="card"
                  style={{ cursor: "pointer", transition: "all 0.2s" }}
                  onClick={() => setSelectedReport(report.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-color)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ marginBottom: 8 }}>
                        {report.reportType} Report: {new Date(report.periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h4>
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                        {report.studentName} • Generated {new Date(report.generatedAt).toLocaleDateString()}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>XP Earned</div>
                          <div style={{ fontSize: 18, fontWeight: 600 }}>{report.totalXPEarned}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Hours Logged</div>
                          <div style={{ fontSize: 18, fontWeight: 600 }}>{report.hoursLogged}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Projects Done</div>
                          <div style={{ fontSize: 18, fontWeight: 600 }}>{report.projectsCompleted}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Passions</div>
                          <div style={{ fontSize: 18, fontWeight: 600 }}>{report.passionsActive}</div>
                        </div>
                      </div>
                    </div>
                    <button className="button secondary" style={{ marginLeft: 16 }}>
                      View Report →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Settings */}
          <div className="card" style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 16 }}>Report Preferences</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
              Customize how often you receive progress reports and notifications.
            </p>
            <form>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Report Frequency
                </label>
                <select
                  defaultValue="MONTHLY"
                  style={{ width: "100%", maxWidth: 400, padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Bi-weekly</option>
                  <option value="MONTHLY">Monthly (Recommended)</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked />
                  <span>Email me when new reports are ready</span>
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked />
                  <span>Include portfolio work samples in reports</span>
                </label>
              </div>
              <button type="submit" className="button primary">
                Save Preferences
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          {/* Full Report View */}
          <button
            onClick={() => setSelectedReport(null)}
            className="button secondary"
            style={{ marginBottom: 20 }}
          >
            ← Back to All Reports
          </button>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginBottom: 8 }}>
              {currentReport?.reportType} Progress Report
            </h2>
            <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 20 }}>
              {currentReport?.studentName} • {new Date(currentReport?.periodStart!).toLocaleDateString()} - {new Date(currentReport?.periodEnd!).toLocaleDateString()}
            </div>

            {/* Stats Summary */}
            <div className="grid four" style={{ marginBottom: 28 }}>
              <div style={{ textAlign: "center" }}>
                <div className="kpi">{currentReport?.totalXPEarned}</div>
                <div className="kpi-label">XP Earned</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="kpi">{currentReport?.hoursLogged}</div>
                <div className="kpi-label">Hours Logged</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="kpi">{currentReport?.projectsCompleted}</div>
                <div className="kpi-label">Projects Done</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="kpi">{currentReport?.passionsActive}</div>
                <div className="kpi-label">Active Passions</div>
              </div>
            </div>

            {/* Highlights */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>🌟</span> Highlights & Achievements
              </h3>
              <div style={{
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1px solid #10b981",
                borderRadius: 8,
                padding: 20
              }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                  {currentReport?.highlights}
                </p>
              </div>
            </div>

            {/* Areas of Growth */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>📈</span> Areas of Growth
              </h3>
              <div style={{
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                border: "1px solid #6366f1",
                borderRadius: 8,
                padding: 20
              }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                  {currentReport?.areasOfGrowth}
                </p>
              </div>
            </div>

            {/* Recommendations */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>💡</span> Recommendations for Parents
              </h3>
              <div style={{
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                border: "1px solid #f59e0b",
                borderRadius: 8,
                padding: 20
              }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                  {currentReport?.recommendations}
                </p>
              </div>
            </div>

            {/* Instructor Notes */}
            {currentReport?.instructorNotes && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>👨‍🏫</span> Instructor Notes
                </h3>
                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 8,
                  padding: 20,
                  borderLeft: "4px solid var(--primary-color)"
                }}>
                  <p style={{ fontSize: 15, lineHeight: 1.7, fontStyle: "italic" }}>
                    "{currentReport?.instructorNotes}"
                  </p>
                </div>
              </div>
            )}

            {/* Showcase Items */}
            {currentReport?.showcaseItems && currentReport.showcaseItems.length > 0 && (
              <div>
                <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🎨</span> Notable Work This Period
                </h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {currentReport.showcaseItems.map((item, index) => (
                    <li key={index} style={{
                      padding: "12px 16px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: 6,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 12
                    }}>
                      <span style={{ fontSize: 20 }}>✓</span>
                      <span style={{ fontSize: 15 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
