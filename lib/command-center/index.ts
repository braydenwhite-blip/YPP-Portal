/**
 * Command Center OS — deterministic adapters that turn Queue Engine output (and
 * a few existing loaders) into calm operating view-models for Today, Decide,
 * Meet, Review, Follow Up, and Delegate. Pure and serializable: the pages run
 * these on the server and hand the result to client workspaces.
 */
export * from "./shared";
export * from "./today";
export * from "./decide";
export * from "./delegate";
export * from "./review";
export * from "./follow-up";
export * from "./meet";
