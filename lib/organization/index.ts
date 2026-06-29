// The Organization Graph — public surface.
//
// A pure, derived relationship layer over the chapter's existing operating data.
// The loader (graph-loader.ts) is the only impure module; everything re-exported
// here is pure + deterministic and safe to unit test with fixtures.

export * from "@/lib/organization/types";
export * from "@/lib/organization/graph";
export * from "@/lib/organization/query";
export * from "@/lib/organization/health";
export * from "@/lib/organization/dependencies";
export * from "@/lib/organization/timeline";
export * from "@/lib/organization/recommendations";
export * from "@/lib/organization/entity-summary";
export * from "@/lib/organization/view-model";
