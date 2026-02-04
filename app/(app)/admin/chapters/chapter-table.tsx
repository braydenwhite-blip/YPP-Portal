"use client";

import { useState } from "react";
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
}

export default function ChapterTable({
  chapters
}: {
  chapters: ChapterData[];
}) {
  const columns = [
    { key: "name", label: "Chapter" },
    { key: "city", label: "City" },
    { key: "region", label: "Region" },
    {
      key: "totalUsers",
      label: "Users",
      render: (item: ChapterData) => (
        <span className="pill">{item.totalUsers}</span>
      )
    },
    {
      key: "instructorCount",
      label: "Instructors",
      render: (item: ChapterData) => item.instructorCount
    },
    {
      key: "studentCount",
      label: "Students",
      render: (item: ChapterData) => item.studentCount
    },
    {
      key: "coursesCount",
      label: "Courses",
      render: (item: ChapterData) => item.coursesCount
    },
    {
      key: "openPositions",
      label: "Open Positions",
      render: (item: ChapterData) => item.openPositions > 0 ? (
        <span className="pill pill-success">{item.openPositions}</span>
      ) : "0"
    }
  ];

  const filterOptions = [
    {
      key: "region",
      label: "All Regions",
      options: [...new Set(chapters.map(c => c.region).filter(Boolean))].map(r => ({
        value: r,
        label: r
      }))
    }
  ];

  return (
    <DataTable
      data={chapters}
      columns={columns}
      searchKeys={["name", "city", "region", "partnerSchool"]}
      filterOptions={filterOptions}
      exportFilename="chapters"
    />
  );
}
