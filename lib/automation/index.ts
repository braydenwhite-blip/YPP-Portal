// Public surface of the Automation Brain. Pure modules are re-exported directly;
// the server-only aggregator is re-exported TYPE-ONLY so importing this barrel
// from a client component never pulls `server-only` into the client bundle.
// (Import `loadChapterAutomations` / `assembleChapterAutomation` directly from
// `@/lib/automation/build-chapter-automation` in server code.)

export * from "@/lib/automation/types";
export * from "@/lib/automation/date-helpers";
export * from "@/lib/automation/item-identity";
export * from "@/lib/automation/rank";
export * from "@/lib/automation/playbook";
export * from "@/lib/automation/stage-detector";
export * from "@/lib/automation/readiness";
export * from "@/lib/automation/escalation";
export * from "@/lib/automation/impact-meeting-prep";
export * from "@/lib/automation/workflows";
export * from "@/lib/automation/build-item";
export * from "@/lib/automation/normalize/from-blockers";
export * from "@/lib/automation/normalize/from-student-needs";
export { buildCadenceItems, buildPlaybookPacingItem } from "@/lib/automation/rules/cadence";

// Pure assembly core (no Prisma / server-only). The server loader
// `loadChapterAutomations` is imported directly from
// `@/lib/automation/build-chapter-automation` in server code.
export {
  assembleChapterAutomation,
  type ChapterAutomation,
  type AssembleInput,
  type AutomationDismissalOverlay,
} from "@/lib/automation/assemble";
