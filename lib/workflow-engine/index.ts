// Public surface of the Universal Workflow Engine. Only the PURE, client-safe
// modules are re-exported here. Server-only modules (engine, effects, queries,
// definition, seed, cron, *-actions) are imported directly from their files in
// server code so importing this barrel never pulls `server-only` into a client
// bundle (mirrors lib/automation/index.ts).

export * from "@/lib/workflow-engine/types";
export * from "@/lib/workflow-engine/constants";
export * from "@/lib/workflow-engine/runtime";
export * from "@/lib/workflow-engine/analytics";
export * from "@/lib/workflow-engine/blueprints";
export { slugify } from "@/lib/workflow-engine/slug";
