"use client";

import { useState } from "react";
import DataTable from "@/components/data-table";
import { assignMentorBulk, updateChapterBulk } from "@/lib/bulk-actions";
import {
  CertChip,
  IdentityCell,
  Meter,
  SuiteChip,
} from "@/components/people-strategy/people-suite";

interface Student {
  id: string;
  name: string;
  email: string;
  chapter: string;
  chapterId: string;
  grade: number | null;
  school: string;
  enrolledCourses: number;
  completedCourses: number;
  certificates: number;
  mentorId: string;
  mentorName: string;
  advisorName: string;
  advisorAssignmentId: string;
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

export default function StudentTable({
  students,
  chapters,
  mentors
}: {
  students: Student[];
  chapters: Chapter[];
  mentors: Mentor[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMentorId, setBulkMentorId] = useState("");
  const [bulkChapterId, setBulkChapterId] = useState("");

  const columns = [
    {
      key: "name",
      label: "Student",
      render: (item: Student) => (
        <IdentityCell name={item.name} sub={item.email} />
      )
    },
    {
      key: "chapter",
      label: "Chapter",
      render: (item: Student) =>
        item.chapter && item.chapter !== "None" ? (
          <SuiteChip>{item.chapter}</SuiteChip>
        ) : (
          <SuiteChip muted>No chapter</SuiteChip>
        )
    },
    {
      key: "grade",
      label: "Grade",
      render: (item: Student) =>
        item.grade ? (
          <SuiteChip>Grade {item.grade}</SuiteChip>
        ) : (
          <span style={{ color: "var(--gray-400)" }}>—</span>
        )
    },
    { key: "school", label: "School" },
    {
      key: "enrolledCourses",
      label: "Courses",
      render: (item: Student) => {
        const total = item.enrolledCourses + item.completedCourses;
        return (
          <Meter
            value={item.completedCourses}
            max={total || 1}
            tone="success"
            width={140}
            label={
              <>
                <strong style={{ color: "var(--ps-ink)" }}>{item.enrolledCourses}</strong> active ·{" "}
                {item.completedCourses} done
              </>
            }
          />
        );
      }
    },
    {
      key: "certificates",
      label: "Certs",
      render: (item: Student) => <CertChip count={item.certificates} />
    },
    {
      key: "mentorName",
      label: "Mentor",
      render: (item: Student) =>
        item.mentorId ? (
          <SuiteChip>{item.mentorName}</SuiteChip>
        ) : (
          <SuiteChip muted>Unassigned</SuiteChip>
        )
    },
    {
      key: "advisorName",
      label: "Advisor",
      render: (item: Student) =>
        item.advisorAssignmentId ? (
          <a href={`/my-advisees/${item.advisorAssignmentId}`}>
            <SuiteChip>{item.advisorName}</SuiteChip>
          </a>
        ) : (
          <SuiteChip muted>No advisor</SuiteChip>
        )
    }
  ];

  const filterOptions = [
    {
      key: "chapterId",
      label: "All Chapters",
      options: chapters.map((c) => ({ value: c.id, label: c.name }))
    },
    {
      key: "grade",
      label: "All Grades",
      options: [
        { value: "6", label: "Grade 6" },
        { value: "7", label: "Grade 7" },
        { value: "8", label: "Grade 8" },
        { value: "9", label: "Grade 9" },
        { value: "10", label: "Grade 10" },
        { value: "11", label: "Grade 11" },
        { value: "12", label: "Grade 12" }
      ]
    }
  ];

  const handleBulkAssignMentor = async () => {
    if (!bulkMentorId || selectedIds.length === 0) return;
    const formData = new FormData();
    formData.append("mentorId", bulkMentorId);
    formData.append("menteeIds", JSON.stringify(selectedIds));
    formData.append("type", "STUDENT");
    await assignMentorBulk(formData);
    setSelectedIds([]);
    setBulkMentorId("");
  };

  const handleBulkUpdateChapter = async () => {
    if (selectedIds.length === 0) return;
    const formData = new FormData();
    formData.append("chapterId", bulkChapterId);
    formData.append("userIds", JSON.stringify(selectedIds));
    await updateChapterBulk(formData);
    setSelectedIds([]);
    setBulkChapterId("");
  };

  return (
    <DataTable
      data={students}
      columns={columns}
      searchKeys={["name", "email", "school"]}
      filterOptions={filterOptions}
      exportFilename="students"
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
          <select
            className="input"
            value={bulkChapterId}
            onChange={(e) => setBulkChapterId(e.target.value)}
            style={{ width: "auto", marginTop: 0, marginLeft: 16 }}
          >
            <option value="">Move to Chapter...</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
          <button
            className="button small secondary"
            onClick={handleBulkUpdateChapter}
            style={{ marginTop: 0, marginLeft: 8 }}
          >
            Move
          </button>
        </div>
      }
    />
  );
}
