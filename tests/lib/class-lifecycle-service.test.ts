import { describe, expect, it } from "vitest";
import { deriveClassLifecycle } from "@/lib/class-lifecycle-service";
const future = new Date(Date.now()+86400000); const past = new Date(Date.now()-86400000);
function off(o:any={}) { return { id:"o1", title:"Story Lab", chapterId:"c1", status:"PUBLISHED", instructorId:"i1", deliveryMode:"VIRTUAL", zoomLink:"z", familyEnrollmentConfig:{mode:"DIRECT"}, template:{minStudents:1}, sessions:[{id:"s1",date:future,isCancelled:false,attendance:[]}], enrollments:[{status:"ENROLLED"}], guardianApprovalRequests:[], familyFormRequirements:[], familySupportRequests:[], ...o }; }
describe("class lifecycle service",()=>{
 it("derives missing instructor blocker",()=> expect(deriveClassLifecycle(off({instructorId:null,instructor:null}))).toMatchObject({stage:"needs_instructor", blocker:{code:"INSTRUCTOR_MISSING", owner:"CHAPTER"}}));
 it("derives family readiness blocker",()=> expect(deriveClassLifecycle(off({guardianApprovalRequests:[{status:"PENDING"}]}))).toMatchObject({stage:"family_actions_pending", counts:{pendingApprovals:1}}));
 it("derives session readiness blocker",()=> expect(deriveClassLifecycle(off({zoomLink:null, deliveryMode:"VIRTUAL"}))).toMatchObject({stage:"needs_setup", blocker:{code:"LOCATION_MISSING"}}));
 it("derives attendance blocker",()=> expect(deriveClassLifecycle(off({sessions:[{id:"s0",date:past,isCancelled:false,attendance:[]}]}))).toMatchObject({stage:"needs_follow_up", blocker:{code:"ATTENDANCE_MISSING"}}));
 it("derives cancelled and next-session planning states",()=>{ expect(deriveClassLifecycle(off({status:"CANCELLED"})).stage).toBe("cancelled"); expect(deriveClassLifecycle(off({status:"COMPLETED",sessions:[{id:"s0",date:past,isCancelled:false,attendance:[{}]}]})).stage).toBe("next_session_planning"); });
 it("marks ready when blockers resolve",()=> expect(deriveClassLifecycle(off()).stage).toBe("ready_to_launch"));
});
