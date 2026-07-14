import { beforeEach, describe, expect, it, vi } from "vitest";
const db = { user: { findUnique: vi.fn() }, actionEmailLog: { upsert: vi.fn() }, notificationPreference: { findUnique: vi.fn() }, notification: { upsert: vi.fn(), create: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const { notifyOperational } = await import("@/lib/operational-notification-service");
beforeEach(()=>{ vi.clearAllMocks(); db.notificationPreference.findUnique.mockResolvedValue(null); db.notification.upsert.mockResolvedValue({}); });
describe("operational notification delivery", () => {
  it("writes in-portal and email ledger for email-capable operational events", async () => { db.user.findUnique.mockResolvedValue({ id: "u1", email: "u@example.test" }); await notifyOperational({ userId: "u1", eventType: "WAITLIST_OFFER_CREATED", title: "Seat", body: "Open", dedupeKey: "w1", operational: true }); expect(db.notification.upsert).toHaveBeenCalled(); expect(db.actionEmailLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { dedupeKey: "operational:w1:email" } })); });
  it("dedupes and skips email when no recipient email exists", async () => { db.user.findUnique.mockResolvedValue({ id: "u1", email: null }); const result = await notifyOperational({ userId: "u1", eventType: "FORM_REQUIRED", title: "Form", body: "Required", dedupeKey: "f1" }); expect(result.emailQueued).toBe(false); expect(db.actionEmailLog.upsert).not.toHaveBeenCalled(); });
});
