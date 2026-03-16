"use client";

import { useState } from "react";
import { enrollChildInClassOffering } from "@/lib/parent-actions";

interface ClassOffering {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  timezone: string;
  deliveryMode: string;
  locationName: string | null;
  capacity: number;
  semester: string | null;
  instructorName: string;
  seatsRemaining: number;
}

export default function ParentEnrollOffering({
  studentId,
  studentName,
  offerings,
}: {
  studentId: string;
  studentName: string;
  offerings: ClassOffering[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "VIRTUAL" | "IN_PERSON">("ALL");
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [enrollError, setEnrollError] = useState<Record<string, string>>({});

  const firstName = studentName.split(" ")[0];

  const filtered = offerings.filter((o) => {
    const matchesSearch =
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.instructorName.toLowerCase().includes(search.toLowerCase());
    const isVirtual = o.deliveryMode === "VIRTUAL";
    const matchesMode =
      filterMode === "ALL" ||
      (filterMode === "VIRTUAL" && isVirtual) ||
      (filterMode === "IN_PERSON" && !isVirtual);
    return matchesSearch && matchesMode;
  });

  async function handleEnroll(offeringId: string) {
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("offeringId", offeringId);
    try {
      await enrollChildInClassOffering(fd);
      setEnrolled((prev) => new Set([...prev, offeringId]));
      setEnrollError((prev) => {
        const next = { ...prev };
        delete next[offeringId];
        return next;
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to enroll. Please try again.";
      setEnrollError((prev) => ({ ...prev, [offeringId]: msg }));
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="button small outline"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen
          ? "Close"
          : offerings.length === 0
          ? `No classes available for ${firstName} right now`
          : `Browse Classes for ${firstName}`}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          {/* Filter Bar */}
          <div
            style={{
              padding: "10px 12px",
              background: "var(--surface-alt)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              className="input"
              placeholder="Search classes or instructors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 160px", margin: 0, fontSize: 13 }}
            />
            {(["ALL", "VIRTUAL", "IN_PERSON"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`button small${filterMode === mode ? "" : " secondary"}`}
                style={{ flexShrink: 0 }}
              >
                {mode === "ALL" ? "All" : mode === "VIRTUAL" ? "Virtual" : "In-Person"}
              </button>
            ))}
          </div>

          {/* Offerings */}
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              {offerings.length === 0
                ? "No upcoming classes are open for enrollment right now."
                : "No classes match your filters."}
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {filtered.map((offering) => {
                const isEnrolled = enrolled.has(offering.id);
                const isFull = offering.seatsRemaining <= 0;
                const isLowSeats = offering.seatsRemaining > 0 && offering.seatsRemaining <= 5;
                const error = enrollError[offering.id];

                return (
                  <div
                    key={offering.id}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      background: isEnrolled ? "#f0fdf4" : "transparent",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          marginBottom: 4,
                          color: "var(--foreground)",
                        }}
                      >
                        {offering.title}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          className="pill"
                          style={{
                            background:
                              offering.deliveryMode === "VIRTUAL"
                                ? "#e0e7ff"
                                : "#fef3c7",
                            color:
                              offering.deliveryMode === "VIRTUAL"
                                ? "#3730a3"
                                : "#92400e",
                          }}
                        >
                          {offering.deliveryMode === "VIRTUAL" ? "Virtual" : "In-Person"}
                        </span>
                        {offering.semester && (
                          <span className="pill">{offering.semester}</span>
                        )}
                        <span
                          className="pill"
                          style={{
                            background: isFull
                              ? "#fef2f2"
                              : isLowSeats
                              ? "#fff7ed"
                              : "#f0fdf4",
                            color: isFull
                              ? "#991b1b"
                              : isLowSeats
                              ? "#c2410c"
                              : "#166534",
                          }}
                        >
                          {isFull
                            ? "Full"
                            : `${offering.seatsRemaining} seat${offering.seatsRemaining !== 1 ? "s" : ""} left`}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px 12px",
                        }}
                      >
                        <span>
                          📅{" "}
                          {new Date(offering.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          –{" "}
                          {new Date(offering.endDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {offering.meetingDays.length > 0 && (
                          <span>
                            🗓 {offering.meetingDays.join(", ")}
                            {offering.meetingTime && ` · ${offering.meetingTime}`}
                          </span>
                        )}
                        {offering.deliveryMode !== "VIRTUAL" &&
                          offering.locationName && (
                            <span>📍 {offering.locationName}</span>
                          )}
                        <span>👤 {offering.instructorName}</span>
                      </div>

                      {error && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            color: "#dc2626",
                          }}
                        >
                          {error}
                        </p>
                      )}

                      {isEnrolled && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            color: "#16a34a",
                            fontWeight: 600,
                          }}
                        >
                          ✓ Enrolled! First session starts{" "}
                          {new Date(offering.startDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          .
                        </p>
                      )}
                    </div>

                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      {isEnrolled ? (
                        <span
                          className="pill"
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            fontWeight: 600,
                          }}
                        >
                          Enrolled
                        </span>
                      ) : (
                        <button
                          className="button small"
                          disabled={isFull}
                          onClick={() => handleEnroll(offering.id)}
                          style={{ opacity: isFull ? 0.5 : 1 }}
                        >
                          {isFull ? "Full" : "Enroll"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
