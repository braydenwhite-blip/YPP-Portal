import { describe, expect, it } from "vitest";
import { canGuardianApproveEnrollment, canGuardianManageEnrollment, canGuardianSignForms, canGuardianUpdateProfileField, canGuardianViewLearning, canStudentUpdateProfileField, filterGuardianFacingRecord, getPortalRoles } from "@/lib/family-access";

const active = { relationshipStatus: "ACTIVE", revokedAt: null, canViewLearning: true, canManageEnrollment: true, canApproveEnrollment: false, canSignForms: true, canUpdateContactInformation: true, canManageCommunicationPreferences: false, canSubmitSupportRequests: true, canReceiveProgramNotifications: true } as any;

describe("family access helpers", () => {
  it("resolves multiple valid portal roles", () => {
    expect(getPortalRoles({ primaryRole: "STUDENT", roles: ["PARENT", "STUDENT"] })).toEqual(["STUDENT", "PARENT"]);
  });
  it("enforces guardian permission flags", () => {
    expect(canGuardianViewLearning(active)).toBe(true);
    expect(canGuardianManageEnrollment(active)).toBe(true);
    expect(canGuardianApproveEnrollment(active)).toBe(false);
    expect(canGuardianSignForms(active)).toBe(true);
  });
  it("revoked relationships lose access", () => {
    expect(canGuardianViewLearning({ ...active, revokedAt: new Date() })).toBe(false);
    expect(canGuardianViewLearning({ ...active, relationshipStatus: "REVOKED" })).toBe(false);
  });
  it("student profile ownership is field-scoped", () => {
    expect(canStudentUpdateProfileField("s1", "s1", "interests")).toBe(true);
    expect(canStudentUpdateProfileField("s1", "s2", "interests")).toBe(false);
    expect(canStudentUpdateProfileField("s1", "s1", "parentEmail")).toBe(false);
  });
  it("guardian profile updates are permission and field scoped", () => {
    expect(canGuardianUpdateProfileField(active, "parentPhone")).toBe(true);
    expect(canGuardianUpdateProfileField(active, "legalName")).toBe(false);
  });
  it("filters restricted fields", () => {
    expect(filterGuardianFacingRecord({ title: "ok", reviewerNote: "private", internalNotes: "private", score: 1 })).toEqual({ title: "ok" });
  });
});
