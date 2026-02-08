"use client";

import { useState } from "react";
import { enrollChildInCourse } from "@/lib/parent-actions";

interface Course {
  id: string;
  title: string;
  format: string;
  level: string | null;
}

export default function ParentEnroll({
  studentId,
  studentName,
  courses,
  enrolledCourseIds,
}: {
  studentId: string;
  studentName: string;
  courses: Course[];
  enrolledCourseIds: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const enrolledSet = new Set(enrolledCourseIds);

  const availableCourses = courses.filter(
    (c) => !enrolledSet.has(c.id) && c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="button small outline"
        onClick={() => setIsOpen(!isOpen)}
        style={{ marginTop: 0 }}
      >
        {isOpen ? "Close" : `Enroll ${studentName.split(" ")[0]} in a Course`}
      </button>

      {isOpen && (
        <div className="parent-enroll-panel">
          <input
            className="input"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 8, marginBottom: 8 }}
          />
          {availableCourses.length === 0 ? (
            <p className="empty" style={{ padding: "8px 0" }}>
              {search ? "No courses match your search." : "All available courses are already enrolled."}
            </p>
          ) : (
            <div className="parent-enroll-list">
              {availableCourses.slice(0, 10).map((course) => (
                <div key={course.id} className="parent-enroll-item">
                  <div>
                    <strong style={{ fontSize: 14 }}>{course.title}</strong>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span className="pill pill-small pill-info">
                        {course.format.replace(/_/g, " ")}
                      </span>
                      {course.level && (
                        <span className={`pill pill-small level-${course.level.replace("LEVEL_", "")}`}>
                          {course.level.replace("LEVEL_", "Level ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={enrollChildInCourse}>
                    <input type="hidden" name="studentId" value={studentId} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="button small" type="submit" style={{ marginTop: 0 }}>
                      Enroll
                    </button>
                  </form>
                </div>
              ))}
              {availableCourses.length > 10 && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                  Showing first 10 of {availableCourses.length} courses. Use search to find more.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
