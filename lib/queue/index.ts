/**
 * Queue Engine — public surface (client-safe).
 *
 * Pure model, folders, ranking, resolution routing, selectors, and the engine
 * assembly. The server-only loader (`loadQueueEngine`) lives in
 * `@/lib/queue/load` so importing this barrel never pulls the DB into a client
 * bundle.
 */
export * from "./types";
export * from "./ranking";
export * from "./resolution";
export * from "./selectors";
export * from "./from-work-hub";
export * from "./from-attention";
export * from "./from-initiatives";
export { buildQueueEngine, getEngineQueue, type QueueEngine, type TriageGroup } from "./engine";
