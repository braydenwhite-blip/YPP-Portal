"use client";

import { useState, useTransition } from "react";
import {
  createApplicationCohort,
  batchUpdateStatus,
  type BatchUpdateResult,
} from "@/lib/application-cohort-actions";

interface Cohort {
  id: string;
  name: string;
  type: string;
  roleType: string;
  _count: {
    instructorApplications: number;
    chapterPresidentApplications: number;
  };
  createdAt: string;
}

interface ApplicationCohortManagerProps {
  cohorts: Cohort[];
}

export default function ApplicationCohortManager({
  cohorts,
}: ApplicationCohortManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchUpdateResult | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createApplicationCohort(formData);
      setShowCreateForm(false);
    });
  }

  function handleBatchApprove(cohortId: string, roleType: string) {
    const applicationType =
      roleType === "CHAPTER_PRESIDENT" ? "chapter_president" : "instructor";
    setBatchSummary(null);
    startTransition(async () => {
      const result = await batchUpdateStatus(cohortId, "APPROVED", applicationType);
      setBatchSummary(result);
    });
  }

  function handleBatchReject(cohortId: string, roleType: string) {
    const applicationType =
      roleType === "CHAPTER_PRESIDENT" ? "chapter_president" : "instructor";
    setBatchSummary(null);
    startTransition(async () => {
      const result = await batchUpdateStatus(cohortId, "REJECTED", applicationType);
      setBatchSummary(result);
    });
  }

  function getMemberCount(cohort: Cohort) {
    return (
      cohort._count.instructorApplications +
      cohort._count.chapterPresidentApplications
    );
  }

  function getTypePillStyle(type: string) {
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: 600,
      backgroundColor:
        type === "APPLICATION_CYCLE"
          ? "#dbeafe"
          : "#fef3c7",
      color:
        type === "APPLICATION_CYCLE"
          ? "#1e40af"
          : "#92400e",
    };
  }

  function getRoleTypePillStyle(roleType: string) {
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: 600,
      backgroundColor:
        roleType === "CHAPTER_PRESIDENT"
          ? "#f0e6ff"
          : "#dcfce7",
      color:
        roleType === "CHAPTER_PRESIDENT"
          ? "#5a1da8"
          : "#166534",
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            backgroundColor: "#2563eb",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showCreateForm ? "Cancel" : "Create New Cohort"}
        </button>
      </div>

      {batchSummary && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            border: `1px solid ${batchSummary.ok ? "#bbf7d0" : "#fecaca"}`,
            backgroundColor: batchSummary.ok ? "#f0fdf4" : "#fef2f2",
            fontSize: "13px",
            color: batchSummary.ok ? "#166534" : "#991b1b",
          }}
        >
          {batchSummary.ok ? (
            <>
              <strong>Batch complete:</strong> {batchSummary.updated}/{batchSummary.total} updated, {batchSummary.emailed} emailed
              {batchSummary.skipped.length > 0 && (
                <span> · {batchSummary.skipped.length} skipped (invalid transition)</span>
              )}
              {batchSummary.emailFailures > 0 && (
                <span> · {batchSummary.emailFailures} email failure{batchSummary.emailFailures !== 1 ? "s" : ""}</span>
              )}
            </>
          ) : (
            <><strong>Error:</strong> {batchSummary.error}</>
          )}
          <button
            onClick={() => setBatchSummary(null)}
            style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
          >
            ✕
          </button>
        </div>
      )}

      {showCreateForm && (
        <div
          className="card"
          style={{
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
            Create New Cohort
          </h3>
          <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label
                style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}
              >
                Cohort Name
              </label>
              <input
                className="input"
                name="name"
                required
                placeholder="e.g. Spring 2026 Instructor Cycle"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}
                >
                  Type
                </label>
                <select
                  className="input"
                  name="type"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                >
                  <option value="">Select type...</option>
                  <option value="APPLICATION_CYCLE">Application Cycle</option>
                  <option value="TRAINING">Training</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label
                  style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}
                >
                  Role Type
                </label>
                <select
                  className="input"
                  name="roleType"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                >
                  <option value="">Select role type...</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="CHAPTER_PRESIDENT">Chapter President</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="button"
                type="submit"
                disabled={isPending}
                style={{
                  backgroundColor: "#16a34a",
                  color: "#fff",
                  padding: "8px 20px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? "Creating..." : "Create Cohort"}
              </button>
            </div>
          </form>
        </div>
      )}

      {cohorts.length === 0 && (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "32px 0" }}>
          No cohorts found. Create one to get started.
        </p>
      )}

      {cohorts.map((cohort) => {
        const isExpanded = expandedId === cohort.id;
        const memberCount = getMemberCount(cohort);

        return (
          <div
            key={cohort.id}
            className="card"
            style={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedId(isExpanded ? null : cohort.id)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                    fontSize: "12px",
                  }}
                >
                  &#9654;
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                    {cohort.name}
                  </h3>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <span className="pill" style={getTypePillStyle(cohort.type)}>
                      {cohort.type === "APPLICATION_CYCLE"
                        ? "Application Cycle"
                        : "Training"}
                    </span>
                    <span className="pill" style={getRoleTypePillStyle(cohort.roleType)}>
                      {cohort.roleType === "CHAPTER_PRESIDENT"
                        ? "Chapter President"
                        : "Instructor"}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {memberCount} member{memberCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {isExpanded && (
              <div
                style={{
                  padding: "16px 20px",
                  borderTop: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    Instructor Applications: {cohort._count.instructorApplications}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    Chapter President Applications:{" "}
                    {cohort._count.chapterPresidentApplications}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="button"
                    disabled={isPending || memberCount === 0}
                    onClick={() => handleBatchApprove(cohort.id, cohort.roleType)}
                    style={{
                      backgroundColor: "#16a34a",
                      color: "#fff",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: memberCount === 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                      opacity: isPending || memberCount === 0 ? 0.6 : 1,
                    }}
                  >
                    {isPending ? "Updating..." : "Batch Approve"}
                  </button>
                  <button
                    className="button"
                    disabled={isPending || memberCount === 0}
                    onClick={() => handleBatchReject(cohort.id, cohort.roleType)}
                    style={{
                      backgroundColor: "#dc2626",
                      color: "#fff",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: memberCount === 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                      opacity: isPending || memberCount === 0 ? 0.6 : 1,
                    }}
                  >
                    {isPending ? "Updating..." : "Batch Reject"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
