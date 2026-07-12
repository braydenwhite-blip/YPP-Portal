"use client";

import { useState } from "react";
import Link from "next/link";

type AnalyticsSection = {
  id: string;
  title: string;
  icon: string;
  description: string;
  color: string;
};

const SECTIONS: AnalyticsSection[] = [
  {
    id: "parent-database",
    title: "Parent Database",
    icon: "🗄️",
    description: "Master source of truth - Google Sheets analytics",
    color: "#f59e0b",
  },
  {
    id: "users",
    title: "Users",
    icon: "👤",
    description: "User management and role distribution",
    color: "#6b21c8",
  },
  {
    id: "courses",
    title: "Courses & Enrollments",
    icon: "📚",
    description: "Course catalog and enrollment analytics",
    color: "#2563eb",
  },
  {
    id: "certificates",
    title: "Certificates",
    icon: "🏆",
    description: "Issued certificates and achievements",
    color: "#059669",
  },
  {
    id: "attendance",
    title: "Attendance Records",
    icon: "✓",
    description: "Session attendance tracking",
    color: "#dc2626",
  },
  {
    id: "events",
    title: "Events",
    icon: "📅",
    description: "Event management and RSVP analytics",
    color: "#d97706",
  },
  {
    id: "feedback",
    title: "Feedback",
    icon: "💬",
    description: "Parent, student, and peer feedback",
    color: "#0891b2",
  },
  {
    id: "audit",
    title: "Audit Logs",
    icon: "📋",
    description: "Admin activity and system changes",
    color: "#7c3aed",
  },
];

interface AnalyticsDashboardProps {
  data: {
    snapshot: Array<{
      key: string;
      label: string;
      value: number;
      tone: string;
      hint: string | null;
    }>;
    attention: Array<{
      category: string;
      count: number;
    }>;
    board: Record<string, any>;
    initiatives: Array<{
      healthLabel?: string;
      progressPercent?: number;
    }>;
    dbAnalytics?: {
      totalUsers: number;
      totalChapters: number;
      totalCourses: number;
      totalEnrollments: number;
      totalActionItems: number;
      totalPartners: number;
      totalMentorships: number;
      totalEvents: number;
      totalCertificates: number;
      totalAttendanceRecords: number;
      totalFeedbackRecords: number;
      totalAuditLogs: number;
      actionItemsByStatus: Record<string, number>;
      usersByRole: Record<string, number>;
      usersByChapter: Array<{ chapterId: string; chapterName: string; count: number }>;
      coursesByFormat: Record<string, number>;
      coursesByLevel: Record<string, number>;
      enrollmentsByStatus: Record<string, number>;
      certificatesByType: Record<string, number>;
      attendanceByStatus: Record<string, number>;
      eventsByType: Record<string, number>;
      feedbackBySource: Record<string, number>;
      feedbackAverageRating: number;
    };
    sheetsAnalytics?: {
      totalPeople: number;
      totalChapters: number;
      totalPrograms: number;
      totalEvents: number;
      lastUpdated: string;
      rawData: Record<string, any>;
    };
  };
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["parent-database", "executive"]));

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="analytics-dashboard" style={{ display: "grid", gap: 16 }}>
      {/* Analytics Sections */}
      {SECTIONS.map((section) => (
        <div
          key={section.id}
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--surface, #fff)",
          }}
        >
          <button
            onClick={() => toggleSection(section.id)}
            style={{
              width: "100%",
              padding: "16px 20px",
              background: openSections.has(section.id) ? section.color : "var(--surface-alt, #f9fafb)",
              color: openSections.has(section.id) ? "#fff" : "var(--ink, #1a0533)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 15,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div>{section.title}</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  {section.description}
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 20,
                transform: openSections.has(section.id) ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▼
            </span>
          </button>

          {openSections.has(section.id) && (
            <div style={{ padding: "20px", background: "var(--surface, #fff)" }}>
              {section.id === "parent-database" && <ParentDatabaseAnalytics data={data} />}
              {section.id === "users" && <UsersAnalytics data={data} />}
              {section.id === "courses" && <CoursesAnalytics data={data} />}
              {section.id === "certificates" && <CertificatesAnalytics data={data} />}
              {section.id === "attendance" && <AttendanceAnalytics data={data} />}
              {section.id === "events" && <EventsAnalytics data={data} />}
              {section.id === "feedback" && <FeedbackAnalytics data={data} />}
              {section.id === "audit" && <AuditAnalytics data={data} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ExecutiveOverview({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const healthScore = data.initiatives.length > 0
    ? Math.round(
        data.initiatives.reduce((acc, init) => acc + (init.progressPercent || 0), 0) /
          data.initiatives.length
      )
    : 0;

  const maxValue = Math.max(...data.snapshot.map((m) => m.value), 1);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Metric Cards with Visual Bars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {data.snapshot.map((metric) => (
          <div
            key={metric.key}
            style={{
              padding: 16,
              background: "var(--surface-alt, #f9fafb)",
              borderRadius: 6,
              border: "1px solid var(--border, #e5e7eb)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>
              {metric.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink, #1a0533)" }}>
              {metric.value}
            </div>
            {metric.hint && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{metric.hint}</div>
            )}
            {/* Visual bar */}
            <div
              style={{
                marginTop: 10,
                height: 6,
                background: "var(--border, #e5e7eb)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(metric.value / maxValue) * 100}%`,
                  background: metric.tone === "danger" ? "#dc2626" : metric.tone === "warning" ? "#f59e0b" : "#6b21c8",
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Health Score Gauge */}
      <div
        style={{
          padding: 16,
          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
          borderRadius: 6,
          border: "1px solid #0ea5e9",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>
          ORGANIZATIONAL HEALTH SCORE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `conic-gradient(#10b981 ${healthScore * 3.6}deg, #e5e7eb ${healthScore * 3.6}deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color: "#065f46",
              }}
            >
              {healthScore}%
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
              Based on {data.initiatives.length} active initiatives
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Average progress across all strategic initiatives
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const lanes = Object.entries(data.board).map(([label, items]) => ({ label, items }));
  const totalItems = lanes.reduce((sum, lane) => sum + lane.items.length, 0);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Work Distribution Chart */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--ink, #1a0533)" }}>
          Work Item Distribution by Status
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {lanes.map((lane) => {
            const percentage = totalItems > 0 ? (lane.items.length / totalItems) * 100 : 0;
            return (
              <div key={lane.label} style={{ display: "grid", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  <span style={{ textTransform: "capitalize" }}>{lane.label.replace(/_/g, " ")}</span>
                  <span style={{ fontWeight: 600 }}>{lane.items.length}</span>
                </div>
                <div
                  style={{
                    height: 24,
                    background: "var(--surface-alt, #f9fafb)",
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${percentage}%`,
                      background: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
                      borderRadius: 4,
                      transition: "width 0.3s",
                      minWidth: percentage > 0 ? 2 : 0,
                    }}
                  />
                  {percentage > 10 && (
                    <div
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {Math.round(percentage)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attention Categories */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--ink, #1a0533)" }}>
          Attention Queue Breakdown
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {data.attention.map((item) => (
            <div
              key={item.category}
              style={{
                padding: 12,
                background: "var(--surface-alt, #f9fafb)",
                borderRadius: 6,
                textAlign: "center",
                border: "1px solid var(--border, #e5e7eb)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}>{item.count}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, textTransform: "capitalize" }}>
                {item.category}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParentDatabaseAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  const sheets = data.sheetsAnalytics;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Database Info Card */}
      <div
        style={{
          padding: 20,
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          border: "2px solid #f59e0b",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>🗄️</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              Parent Database (Master Source)
            </div>
            <div style={{ fontSize: 13, color: "#a16207" }}>
              Google Sheets - Source of truth for all portal data
            </div>
          </div>
        </div>
        <a
          href="https://docs.google.com/spreadsheets/d/1LyZEkUMEeNVi5OXZqYPo9qJHUET8CSeVn9wbA8LiAEs/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "10px 20px",
            background: "#f59e0b",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Open Database →
        </a>
      </div>

      {/* Database Analytics - SEPARATE SECTION */}
      {(sheets || db) && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #1a0533)", marginBottom: 8 }}>
            📊 Database Analytics
          </div>

          {/* Google Sheets Section */}
          {sheets && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
                Google Sheets (Master Database)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ padding: 14, background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4, fontWeight: 600 }}>PEOPLE</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{sheets.totalPeople}</div>
                </div>
                <div style={{ padding: 14, background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4, fontWeight: 600 }}>CHAPTERS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{sheets.totalChapters}</div>
                </div>
                <div style={{ padding: 14, background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4, fontWeight: 600 }}>PROGRAMS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{sheets.totalPrograms}</div>
                </div>
                <div style={{ padding: 14, background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4, fontWeight: 600 }}>EVENTS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{sheets.totalEvents}</div>
                </div>
              </div>
              {sheets.rawData.error && (
                <div style={{ padding: 12, background: "#fef2f2", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
                  {sheets.rawData.note || sheets.rawData.error}
                </div>
              )}
            </div>
          )}

          {/* PostgreSQL Section */}
          {db && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>
                PostgreSQL Database
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>USERS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalUsers}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                    {Object.entries(db.usersByRole).slice(0, 2).map(([r, c]) => `${r}: ${c}`).join(", ")}
                  </div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>CHAPTERS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalChapters}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>COURSES</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalCourses}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{db.totalEnrollments} enrolled</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>ACTION ITEMS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalActionItems}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>PARTNERS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalPartners}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>MENTORSHIPS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalMentorships}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>EVENTS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalEvents}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>CERTIFICATES</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalCertificates}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>ATTENDANCE</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalAttendanceRecords}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>FEEDBACK</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalFeedbackRecords}</div>
                </div>

                <div style={{ padding: 14, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
                  <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 4, fontWeight: 600 }}>AUDIT LOGS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{db.totalAuditLogs}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsersAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
          <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>TOTAL USERS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalUsers || 0}</div>
        </div>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
          <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>CHAPTERS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalChapters || 0}</div>
        </div>
      </div>

      {/* Users by Role */}
      {db && Object.keys(db.usersByRole).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Users by Role</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.usersByRole).map(([role, count]) => (
              <div key={role} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2 }}>{role}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users by Chapter */}
      {db && db.usersByChapter.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Users by Chapter (Top 5)</div>
          <div style={{ display: "grid", gap: 6 }}>
            {db.usersByChapter.slice(0, 5).map((chapter) => (
              <div key={chapter.chapterId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <span style={{ color: "#334155" }}>{chapter.chapterName}</span>
                <span style={{ fontWeight: 700, color: "#0ea5e9" }}>{chapter.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=users&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=users&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function CoursesAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
          <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>TOTAL COURSES</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalCourses || 0}</div>
        </div>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
          <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>ENROLLMENTS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalEnrollments || 0}</div>
        </div>
      </div>

      {/* Courses by Format */}
      {db && Object.keys(db.coursesByFormat).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Courses by Format</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.coursesByFormat).map(([format, count]) => (
              <div key={format} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2, textTransform: "capitalize" }}>{format}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courses by Level */}
      {db && Object.keys(db.coursesByLevel).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Courses by Level</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.coursesByLevel).map(([level, count]) => (
              <div key={level} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2 }}>{level}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrollments by Status */}
      {db && Object.keys(db.enrollmentsByStatus).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Enrollments by Status</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.enrollmentsByStatus).map(([status, count]) => (
              <div key={status} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2, textTransform: "capitalize" }}>{status}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=enrollments&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=enrollments&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function CertificatesAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
        <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>TOTAL CERTIFICATES</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalCertificates || 0}</div>
      </div>
      <div style={{ padding: 12, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#92400e", border: "1px solid #f59e0b" }}>
        ℹ️ Certificates are issued based on course completion and achievement awards
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=certificates&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=certificates&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function AttendanceAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
        <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>ATTENDANCE RECORDS</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalAttendanceRecords || 0}</div>
      </div>

      {/* Attendance by Status */}
      {db && Object.keys(db.attendanceByStatus).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Attendance by Status</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.attendanceByStatus).map(([status, count]) => (
              <div key={status} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2, textTransform: "capitalize" }}>{status}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=attendance&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=attendance&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function EventsAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
        <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>TOTAL EVENTS</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalEvents || 0}</div>
      </div>

      {/* Events by Type */}
      {db && Object.keys(db.eventsByType).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Events by Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.eventsByType).map(([type, count]) => (
              <div key={type} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2, textTransform: "capitalize" }}>{type}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=events&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=events&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function FeedbackAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
        <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>FEEDBACK RECORDS</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalFeedbackRecords || 0}</div>
        {db && db.feedbackAverageRating > 0 && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Avg Rating: {db.feedbackAverageRating}/5</div>
        )}
      </div>

      {/* Feedback by Source */}
      {db && Object.keys(db.feedbackBySource).length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink, #1a0533)" }}>Feedback by Source</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {Object.entries(db.feedbackBySource).map(([source, count]) => (
              <div key={source} style={{ padding: 10, background: "#f0f9ff", borderRadius: 4, border: "1px solid #0ea5e9", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 2, textTransform: "capitalize" }}>{source}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=feedback&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=feedback&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function AuditAnalytics({ data }: { data: AnalyticsDashboardProps["data"] }) {
  const db = data.dbAnalytics;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, border: "1px solid #0ea5e9" }}>
        <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6, fontWeight: 600 }}>AUDIT LOGS</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>{db?.totalAuditLogs || 0}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Last 5,000 entries</div>
      </div>
      <div style={{ padding: 12, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#92400e", border: "1px solid #f59e0b" }}>
        ℹ️ Audit logs track all admin activities and system changes
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/api/export?table=audit-logs&format=csv" className="button small" style={{ textDecoration: "none" }}>
          Download CSV
        </a>
        <a href="/api/export?table=audit-logs&format=json" className="button small secondary" style={{ textDecoration: "none" }}>
          Download JSON
        </a>
      </div>
    </div>
  );
}

function PeopleAnalytics() {
  return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>People & Applications Analytics</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        View detailed analytics at{" "}
        <Link href="/admin/analytics" style={{ color: "#6b21c8", fontWeight: 600 }}>
          /admin/analytics
        </Link>
      </div>
    </div>
  );
}

function ClassesAnalytics() {
  return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Classes & Curriculum Analytics</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        View detailed analytics at{" "}
        <Link href="/admin/analytics" style={{ color: "#6b21c8", fontWeight: 600 }}>
          /admin/analytics
        </Link>
      </div>
    </div>
  );
}

function MentorshipAnalytics() {
  return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Mentorship & Development Analytics</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        View detailed analytics at{" "}
        <Link href="/admin/analytics" style={{ color: "#6b21c8", fontWeight: 600 }}>
          /admin/analytics
        </Link>
      </div>
    </div>
  );
}

function PartnersAnalytics() {
  return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Partners & Outreach Analytics</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        View detailed analytics at{" "}
        <Link href="/admin/partners" style={{ color: "#6b21c8", fontWeight: 600 }}>
          /admin/partners
        </Link>
      </div>
    </div>
  );
}

function TimelineAnalytics() {
  return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Timeline & Activity Analytics</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        View the unified timeline in the section below
      </div>
    </div>
  );
}