import { describe, it, expect } from "vitest";

import {
  generateOutreachEmail,
  renderEmailForClipboard,
  OUTREACH_EMAIL_KINDS,
  DEFAULT_YPP_DESCRIPTION,
  type OutreachEmailContext,
} from "@/lib/partners/outreach-email";

const ctx: OutreachEmailContext = {
  partnerName: "Scarsdale Public Library",
  contactName: "Jane Miller",
  contactTitle: "Youth Services Director",
  chapterName: "Scarsdale Chapter",
  chapterLocation: "Scarsdale, NY",
  presidentName: "Ava Bennett",
  proposedAges: "3rd–8th graders",
  proposedSchedule: "Tuesdays after school",
  fallbackAsk: "we'd happily start with one pilot session.",
};

describe("generateOutreachEmail", () => {
  it("is deterministic — same context yields identical output", () => {
    const a = generateOutreachEmail("INITIAL", ctx);
    const b = generateOutreachEmail("INITIAL", ctx);
    expect(a).toEqual(b);
  });

  it("personalizes the initial email with partner, contact, location, and chapter", () => {
    const email = generateOutreachEmail("INITIAL", ctx);
    expect(email.subject).toContain("Scarsdale Public Library");
    expect(email.body).toContain("Hi Jane,");
    expect(email.body).toContain("Scarsdale, NY");
    expect(email.body).toContain("Ava Bennett");
    expect(email.body).toContain("3rd–8th graders");
    expect(email.body).toContain("Tuesdays after school");
  });

  it("falls back to a generic greeting and default YPP description when fields are missing", () => {
    const sparse = generateOutreachEmail("INITIAL", { partnerName: "Town YMCA" });
    expect(sparse.body).toContain("Hi there,");
    expect(sparse.body).toContain(DEFAULT_YPP_DESCRIPTION);
    expect(sparse.subject).toContain("Town YMCA");
  });

  it("produces every email kind with a non-empty subject and body", () => {
    for (const kind of OUTREACH_EMAIL_KINDS) {
      const email = generateOutreachEmail(kind, ctx);
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.body.length).toBeGreaterThan(0);
      expect(email.body).not.toContain("undefined");
      expect(email.body).not.toContain("null");
    }
  });

  it("the logistics-confirmation email lists the logistics to confirm", () => {
    const email = generateOutreachEmail("LOGISTICS_CONFIRMATION", ctx);
    expect(email.body.toLowerCase()).toContain("room");
    expect(email.body.toLowerCase()).toContain("supervision");
  });

  it("renderEmailForClipboard prefixes the subject", () => {
    const email = generateOutreachEmail("FOLLOW_UP", ctx);
    expect(renderEmailForClipboard(email)).toBe(`Subject: ${email.subject}\n\n${email.body}`);
  });
});
