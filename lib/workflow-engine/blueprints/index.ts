// ============================================================================
// Universal Workflow Engine — blueprint catalog: aggregator
// ============================================================================
//
// Re-exports the full public surface previously provided by the single
// blueprints.ts file, so every existing import of "@/lib/workflow-engine/
// blueprints" keeps working unchanged. Each category file owns one domain's
// business processes — add a new process by adding an entry to the relevant
// category file, never by touching the engine.

export * from "./types";
export * from "./helpers";

import { LEADERSHIP_BLUEPRINTS } from "./leadership";
import { CHAPTER_BLUEPRINTS } from "./chapters";
import { PARTNER_BLUEPRINTS } from "./partners";
import { INSTRUCTOR_BLUEPRINTS } from "./instructors";
import { STUDENT_BLUEPRINTS } from "./students";
import { PROGRAM_BLUEPRINTS } from "./programs";
import { MEETING_BLUEPRINTS } from "./meetings";
import { OPERATIONS_BLUEPRINTS } from "./operations";
import type { WorkflowBlueprint } from "./types";

export { LEADERSHIP_BLUEPRINTS } from "./leadership";
export { CHAPTER_BLUEPRINTS } from "./chapters";
export { PARTNER_BLUEPRINTS } from "./partners";
export { INSTRUCTOR_BLUEPRINTS } from "./instructors";
export { STUDENT_BLUEPRINTS } from "./students";
export { PROGRAM_BLUEPRINTS } from "./programs";
export { MEETING_BLUEPRINTS } from "./meetings";
export { OPERATIONS_BLUEPRINTS } from "./operations";

export const WORKFLOW_BLUEPRINTS: WorkflowBlueprint[] = [
  ...LEADERSHIP_BLUEPRINTS,
  ...CHAPTER_BLUEPRINTS,
  ...PARTNER_BLUEPRINTS,
  ...INSTRUCTOR_BLUEPRINTS,
  ...STUDENT_BLUEPRINTS,
  ...PROGRAM_BLUEPRINTS,
  ...MEETING_BLUEPRINTS,
  ...OPERATIONS_BLUEPRINTS,
];

export function blueprintByKey(key: string): WorkflowBlueprint | undefined {
  return WORKFLOW_BLUEPRINTS.find((b) => b.key === key);
}
