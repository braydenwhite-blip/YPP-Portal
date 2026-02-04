"use client";

import { useState } from "react";
import DataTable from "@/components/data-table";
import { assignMentorBulk } from "@/lib/bulk-actions";

interface Instructor {
  id: string;
  name: string;
  email: string;
  chapter: string;
  chapterId: string;
  approvalStatus: string;
  approvedLevels: string;
  trainingProgress: string;
  trainingPercent: number;
  coursesCount: number;
  mentorId: string;
  mentorName: string;
  createdAt: string;
}

interface Chapter {
  id: string;
  name: string;
}

interface Mentor {
  id: string;
  name: string;
}

export default function InstructorTable({
  instructors,
  chapters,
  mentors
}: {
  instructors: Instructor[];
  chapters: Chapter[];
  mentors: Mentor[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMentorId, setBulkMentorId] = useState("");

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "chapter", label: "Chapter" },
    {
      key: "approvalStatus",
      label: "Status",
      render: (item: Instructor) => (
        <span className={`pill ${getStatusClass(item.approvalStatus)}`}>
          {item.approvalStatus.replace("_", " ")}
        </span>
      )
    },
    { key: "approvedLevels", label: "Levels" },
    {
      key: "trainingProgress",
      label: "Training",
      render: (item: Instructor) => (
        <div className="progress-cell">
          <div className="progress-bar-small">
            <div
              className="progress-bar-fill"
              style={{ width: `${item.trainingPercent}%` }}
            />
          </div>
          <span>{item.trainingProgress}</span>
        </div>
      )
    },
    { key: "coursesCount", label: "Courses" },
    { key: "mentorName", label: "Mentor" }
  ];

  const filterOptions = [
    {
      key: "chapterId",
      label: "All Chapters",
      options: chapters.map((c) => ({ value: c.id, label: c.name }))
    },
    {
      key: "approvalStatus",
      label: "All Statuses",
      options: [
        { value: "INTERVIEW_PENDING", label: "Interview Pending" },
        { value: "TRAINING_IN_PROGRESS", label: "Training In Progress" },
        { value: "APPROVED", label: "Approved" },
        { value: "PAUSED", label: "Paused" }
      ]
    }
  ];

  const handleBulkAssignMentor = async () => {
    if (!bulkMentorId || selectedIds.length === 0) return;
    const formData = new FormData();
    formData.append("mentorId", bulkMentorId);
    formData.append("menteeIds", JSON.stringify(selectedIds));
    formData.append("type", "INSTRUCTOR");
    await assignMentorBulk(formData);
    setSelectedIds([]);
    setBulkMentorId("");
  };

  return (
    <DataTable
      data={instructors}
      columns={columns}
      searchKeys={["name", "email"]}
      filterOptions={filterOptions}
      exportFilename="instructors"
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      bulkActions={
        <div className="bulk-action-form">
          <select
            className="input"
            value={bulkMentorId}
            onChange={(e) => setBulkMentorId(e.target.value)}
            style={{ width: "auto", marginTop: 0 }}
          >
            <option value="">Assign Mentor...</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.name}
              </option>
            ))}
          </select>
          <button
            className="button small"
            onClick={handleBulkAssignMentor}
            disabled={!bulkMentorId}
            style={{ marginTop: 0, marginLeft: 8 }}
          >
            Assign
          </button>
        </div>
      }
    />
  );
}

function getStatusClass(status: string): string {
  switch (status) {
    case "APPROVED":
      return "pill-success";
    case "TRAINING_IN_PROGRESS":
      return "pill-pathway";
    case "INTERVIEW_PENDING":
      return "";
    case "PAUSED":
      return "pill-declined";
    default:
      return "";
  }
}
