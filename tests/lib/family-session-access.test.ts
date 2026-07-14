import { beforeEach, describe, expect, it, vi } from "vitest";
const prismaMock: any = { classSession: { findUnique: vi.fn() }, classEnrollment: { findFirst: vi.fn(), findMany: vi.fn() }, familyFormRequirement: { findMany: vi.fn() }, guardianApprovalRequest: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/family-access", () => ({ filterStudentFacingRecord: (x:any)=>x, filterGuardianFacingRecord:(x:any)=>x, getAccessibleStudentsForGuardian: vi.fn(), requireGuardianAccessToStudent: vi.fn() }));
const { getStudentSessionDetail, getStudentLearning } = await import("@/lib/family-portal-data");
const future = new Date(Date.now()+86400000); const past = new Date(Date.now()-86400000);
function session(date=future){ return { id:"s1", offeringId:"o1", date, offering:{}, attendance:[] }; }
describe("student session logistics visibility", () => {
 beforeEach(()=>{ vi.clearAllMocks(); prismaMock.classSession.findUnique.mockResolvedValue(session()); prismaMock.familyFormRequirement.findMany.mockResolvedValue([]); prismaMock.guardianApprovalRequest.findMany.mockResolvedValue([]); });
 it("enrolled student can access upcoming session detail", async()=>{ prismaMock.classEnrollment.findFirst.mockResolvedValue({id:"e1",status:"ENROLLED"}); await expect(getStudentSessionDetail("stu","s1")).resolves.toMatchObject({session:{id:"s1"}}); });
 it("completed student can access permitted historical detail", async()=>{ prismaMock.classSession.findUnique.mockResolvedValue(session(past)); prismaMock.classEnrollment.findFirst.mockResolvedValue({id:"e1",status:"COMPLETED"}); await expect(getStudentSessionDetail("stu","s1")).resolves.toMatchObject({session:{id:"s1"}}); });
 it("waitlisted student cannot access session detail or join links", async()=>{ prismaMock.classEnrollment.findFirst.mockResolvedValue(null); await expect(getStudentSessionDetail("stu","s1")).resolves.toBeNull(); expect(prismaMock.classEnrollment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: ["ENROLLED", "COMPLETED"] } }) })); });
 it("unrelated student cannot access session detail", async()=>{ prismaMock.classEnrollment.findFirst.mockResolvedValue(null); await expect(getStudentSessionDetail("other","s1")).resolves.toBeNull(); });
 it("revoked or dropped enrollment cannot access session detail", async()=>{ prismaMock.classEnrollment.findFirst.mockResolvedValue(null); await expect(getStudentSessionDetail("stu","s1")).resolves.toBeNull(); });
 it("My Learning does not generate session links for waitlisted students", async()=>{ prismaMock.classEnrollment.findMany.mockResolvedValue([{id:"w1",status:"WAITLISTED",offering:{sessions:[session()],announcements:[]}}, {id:"e1",status:"ENROLLED",offering:{sessions:[session()],announcements:[]}}]); const data=await getStudentLearning("stu"); expect(data.active.map((e:any)=>e.status)).toEqual(["ENROLLED"]); expect(data.upcoming).toHaveLength(1); });
});
