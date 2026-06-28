import { describe, it, expect } from "vitest";
import {
  humanizeToken,
  partnerNoteActivity,
  curriculumReviewActivity,
  classTimelineActivity,
  applicantTimelineActivity,
  enrollmentActivity,
  classFeedbackActivity,
  snapshotActivity,
  attendanceActivity,
  reflectionActivity,
  buildRoomActivity,
  groupActivityByRoom,
  ROOM_ACTIVITY_LIMIT,
  type RoomActivityItem,
} from "@/lib/chapters/room-activity";

const T = (h: number) => new Date(`2026-06-24T${String(h).padStart(2, "0")}:00:00.000Z`);

describe("humanizeToken", () => {
  it("turns UPPER_SNAKE into a sentence-case phrase", () => {
    expect(humanizeToken("GLOBAL_APPROVED")).toBe("Global approved");
    expect(humanizeToken("interview_scheduled")).toBe("Interview scheduled");
    expect(humanizeToken("")).toBe("");
  });
});

describe("source mappers", () => {
  it("maps a partner follow-up note to the Partner Network room", () => {
    const a = partnerNoteActivity({
      id: "n1",
      kind: "FOLLOW_UP",
      body: "Called the front office, will email the MOU.",
      createdAt: T(9),
      partnerId: "p1",
      partnerName: "Lincoln HS",
    });
    expect(a.roomKey).toBe("partner_network");
    expect(a.title).toBe("Follow-up logged with Lincoln HS");
    expect(a.href).toBe("/partners/p1");
    expect(a.description).toContain("Called the front office");
    expect(a.entityId).toBe("p1");
  });

  it("maps a curriculum review event to the Learning Program room with a decision verb", () => {
    const a = curriculumReviewActivity({
      id: "e1",
      decision: "GLOBAL_APPROVED",
      actorName: "Dana Lead",
      createdAt: T(10),
      classTemplateId: "ct1",
      classTemplateTitle: "Intro to Robotics",
    });
    expect(a.roomKey).toBe("learning_program");
    expect(a.title).toBe("Intro to Robotics fully approved");
    expect(a.description).toBe("by Dana Lead");
    expect(a.entityType).toBe("CLASS_TEMPLATE");
  });

  it("falls back to a humanized decision for unknown decisions", () => {
    const a = curriculumReviewActivity({
      id: "e2",
      decision: "WEIRD_STATE",
      actorName: null,
      createdAt: T(10),
      classTemplateId: "ct1",
      classTemplateTitle: "Robotics",
    });
    expect(a.title).toBe("Robotics: Weird state");
  });

  it("maps class, applicant, enrollment, feedback, and snapshot sources to the right rooms", () => {
    expect(classTimelineActivity({ id: "t1", kind: "PUBLISHED", summary: null, createdAt: T(8), offeringId: "o1", offeringTitle: "Robotics Mon" }).roomKey).toBe("live_classes");
    expect(classTimelineActivity({ id: "t1", kind: "PUBLISHED", summary: null, createdAt: T(8), offeringId: "o1", offeringTitle: "Robotics Mon" }).title).toBe("Robotics Mon published");
    expect(applicantTimelineActivity({ id: "at1", kind: "INTERVIEW_SCHEDULED", createdAt: T(8), applicationId: "a1", applicantName: "Sam" }).roomKey).toBe("teaching_org");
    expect(enrollmentActivity({ id: "en1", enrolledAt: T(7), studentName: "Ada", className: "Robotics Mon" }).title).toBe("Ada enrolled in Robotics Mon");
    expect(classFeedbackActivity({ id: "f1", rating: 5, createdAt: T(6), className: "Robotics Mon" }).title).toBe("5★ feedback received on Robotics Mon");
    expect(snapshotActivity({ id: "s1", weekStart: new Date("2026-06-22T00:00:00Z"), createdAt: T(5) }).roomKey).toBe("chapter_growth");
  });

  it("maps attendance (Student Community) and reflection (Live Classes)", () => {
    const att = attendanceActivity({ sessionId: "se1", className: "Robotics Mon", count: 8, occurredAt: T(11), offeringId: "o1" });
    expect(att.roomKey).toBe("student_community");
    expect(att.title).toBe("Attendance recorded for Robotics Mon");
    expect(att.description).toBe("8 students marked");

    const refl = reflectionActivity({ id: "r1", className: "Robotics Mon", actorName: "Sam", createdAt: T(10), offeringId: "o1" });
    expect(refl.roomKey).toBe("live_classes");
    expect(refl.title).toBe("Session reflection submitted on Robotics Mon");
    expect(refl.href).toBe("/admin/classes/o1");
  });
});

describe("buildRoomActivity", () => {
  const items: RoomActivityItem[] = [
    partnerNoteActivity({ id: "n1", kind: "NOTE", body: "x", createdAt: T(9), partnerId: "p1", partnerName: "Lincoln" }),
    enrollmentActivity({ id: "en1", enrolledAt: T(12), studentName: "Ada", className: "Robotics" }),
    snapshotActivity({ id: "s1", weekStart: new Date("2026-06-22T00:00:00Z"), createdAt: T(7) }),
  ];

  it("sorts newest-first", () => {
    const feed = buildRoomActivity(items);
    expect(feed.map((i) => i.id)).toEqual(["enrollment:en1", "partner-note:n1", "snapshot:s1"]);
  });

  it("caps the feed at the limit", () => {
    const many: RoomActivityItem[] = Array.from({ length: ROOM_ACTIVITY_LIMIT + 5 }, (_, i) =>
      enrollmentActivity({ id: `e${i}`, enrolledAt: T(i % 24), studentName: `S${i}`, className: "C" })
    );
    expect(buildRoomActivity(many)).toHaveLength(ROOM_ACTIVITY_LIMIT);
    expect(buildRoomActivity(many, { limit: 3 })).toHaveLength(3);
  });

  it("groups by room", () => {
    const grouped = groupActivityByRoom(buildRoomActivity(items));
    expect(grouped.student_community).toHaveLength(1);
    expect(grouped.partner_network).toHaveLength(1);
    expect(grouped.chapter_growth).toHaveLength(1);
  });
});
