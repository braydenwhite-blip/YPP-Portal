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
  approvalSummary: string;
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
      label: "Publish Workflow",
      render: (item: Instructor) => (
        <span className={`pill ${getStatusClass(item.approvalStatus)}`}>
          {formatStatusLabel(item.approvalStatus)}
        </span>
      )
    },
    { key: "approvalSummary", label: "Offering Approvals" },
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
        { value: "APPROVAL_READY", label: "Approval Ready" },
        { value: "APPROVAL_IN_REVIEW", label: "Approval In Review" },
        { value: "CHANGES_REQUESTED", label: "Changes Requested" },
        { value: "INTERVIEW_PENDING", label: "Interview Pending" },
        { value: "TRAINING_IN_PROGRESS", label: "Training In Progress" },
        { value: "APPROVED", label: "Approved" },
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
    case "APPROVAL_READY":
      return "pill-info";
    case "APPROVAL_IN_REVIEW":
      return "pill-pathway";
    case "CHANGES_REQUESTED":
      return "pill-declined";
    case "TRAINING_IN_PROGRESS":
      return "pill-pathway";
    case "INTERVIEW_PENDING":
      return "";
    default:
      return "";
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "APPROVAL_READY":
      return "Approval Ready";
    case "APPROVAL_IN_REVIEW":
      return "Approval In Review";
    case "CHANGES_REQUESTED":
      return "Changes Requested";
    default:
      return status.replace(/_/g, " ");
  }
}
