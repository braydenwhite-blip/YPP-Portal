"use client";

import Link from "next/link";
import DataTable from "@/components/data-table";

interface ChapterData {
  id: string;
  name: string;
  city: string;
  region: string;
  partnerSchool: string;
  programNotes: string;
  totalUsers: number;
  instructorCount: number;
  studentCount: number;
  leadCount: number;
  coursesCount: number;
  eventsCount: number;
  openPositions: number;
  activeAnnouncements: number;
  createdAt: string;
  archivedAt: string | null;
  health: "healthy" | "warming" | "at-risk";
  healthReason: string;
}

const HEALTH_STYLES: Record<
  ChapterData["health"],
  { label: string; bg: string; color: string }
> = {
  healthy: { label: "Healthy", bg: "#16a34a1A", color: "#16a34a" },
  warming: { label: "Warming", bg: "#d977061A", color: "#d97706" },
  "at-risk": { label: "At-risk", bg: "#dc26261A", color: "#dc2626" },
};

export default function ChapterTable({ chapters }: { chapters: ChapterData[] }) {
  const columns = [
    {
      key: "name",
      label: "Chapter",
      render: (item: ChapterData) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Link
            href={`/admin/chapters/${item.id}`}
            className="link"
            style={{ fontWeight: 600 }}
          >
            {item.name}
          </Link>
          {item.archivedAt ? (
            <span
              className="pill"
              style={{ background: "#fef3c7", color: "#92400e", fontSize: 10 }}
              title={`Archived ${new Date(item.archivedAt).toLocaleDateString()}`}
            >
              Archived
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "city",
      label: "Location",
      render: (item: ChapterData) =>
        [item.city, item.region].filter(Boolean).join(", ") || "—",
    },
    {
      key: "leadCount",
      label: "President",
      render: (item: ChapterData) =>
        item.leadCount > 0 ? (
          <span className="pill pill-success">{item.leadCount}</span>
        ) : (
          <span
            className="pill"
            style={{ background: "#fef3c7", color: "#92400e" }}
            title="No president assigned"
          >
            None
          </span>
        ),
    },
    {
      key: "totalUsers",
      label: "Members",
      render: (item: ChapterData) => <span className="pill">{item.totalUsers}</span>,
    },
    {
      key: "coursesCount",
      label: "Courses",
      render: (item: ChapterData) => item.coursesCount,
    },
    {
      key: "openPositions",
      label: "Open Positions",
      render: (item: ChapterData) =>
        item.openPositions > 0 ? (
          <span className="pill pill-success">{item.openPositions}</span>
        ) : (
          "0"
        ),
    },
    {
      key: "health",
      label: "Health",
      render: (item: ChapterData) => {
        const s = HEALTH_STYLES[item.health];
        return (
          <span
            className="pill"
            style={{ background: s.bg, color: s.color, fontWeight: 600 }}
            title={item.healthReason}
          >
            {s.label}
          </span>
        );
      },
    },
  ];

  const filterOptions = [
    {
      key: "region",
      label: "All Regions",
      options: [...new Set(chapters.map((c) => c.region).filter(Boolean))].map(
        (r) => ({ value: r, label: r })
      ),
    },
    {
      key: "health",
      label: "All Health States",
      options: [
        { value: "healthy", label: "Healthy" },
        { value: "warming", label: "Warming" },
        { value: "at-risk", label: "At-risk" },
      ],
    },
  ];

  return (
    <DataTable
      data={chapters}
      columns={columns}
      searchKeys={["name", "city", "region", "partnerSchool"]}
      filterOptions={filterOptions}
      exportFilename="chapters"
      actions={(item) => (
        <Link
          href={`/admin/chapters/${item.id}`}
          className="button secondary"
          style={{ fontSize: 11 }}
        >
          Open
        </Link>
      )}
    />
  );
}
