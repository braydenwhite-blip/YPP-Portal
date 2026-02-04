"use client";

import { useState } from "react";
import DataTable from "@/components/data-table";

interface ReflectionResponse {
  question: string;
  value: string;
}

interface LatestSubmission {
  id: string;
  formTitle: string;
  month: string;
  submittedAt: string;
  responses: ReflectionResponse[];
}

interface StaffData {
  id: string;
  name: string;
  email: string;
  roles: string;
  chapter: string;
  chapterId: string;
  totalReflections: number;
  latestSubmission: LatestSubmission | null;
}

export default function StaffReflectionsTable({
  staffData
}: {
  staffData: StaffData[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "roles", label: "Roles" },
    { key: "chapter", label: "Chapter" },
    {
      key: "totalReflections",
      label: "Reflections",
      render: (item: StaffData) => (
        <span className={`pill ${item.totalReflections > 0 ? "pill-success" : "pill-declined"}`}>
          {item.totalReflections}
        </span>
      )
    },
    {
      key: "latestSubmission",
      label: "Latest",
      render: (item: StaffData) =>
        item.latestSubmission ? (
          <span>
            {new Date(item.latestSubmission.submittedAt).toLocaleDateString()}
          </span>
        ) : (
          <span style={{ color: "var(--muted)" }}>Never</span>
        )
    }
  ];

  const filterOptions = [
    {
      key: "roles",
      label: "All Roles",
      options: [
        { value: "INSTRUCTOR", label: "Instructors" },
        { value: "CHAPTER_LEAD", label: "Chapter Leads" },
        { value: "STAFF", label: "Staff" }
      ]
    }
  ];

  return (
    <div>
      <DataTable
        data={staffData}
        columns={columns}
        searchKeys={["name", "email", "chapter"]}
        filterOptions={filterOptions}
        exportFilename="staff-reflections"
        actions={(item) => (
          <button
            className="button small"
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            disabled={!item.latestSubmission}
          >
            {expandedId === item.id ? "Hide" : "View"}
          </button>
        )}
      />

      {expandedId && (
        <div className="reflection-detail-modal">
          {(() => {
            const staff = staffData.find((s) => s.id === expandedId);
            const submission = staff?.latestSubmission;
            if (!submission) return null;

            return (
              <div className="card" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>{staff?.name}'s Latest Reflection</h3>
                  <button
                    className="button small secondary"
                    onClick={() => setExpandedId(null)}
                  >
                    Close
                  </button>
                </div>
                <p style={{ color: "var(--muted)", marginBottom: 16 }}>
                  {submission.formTitle} - {new Date(submission.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
                <div className="reflection-responses">
                  {submission.responses.map((response, index) => (
                    <div key={index} className="reflection-response-item">
                      <div className="reflection-question">{response.question}</div>
                      <div className="reflection-answer">{response.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
