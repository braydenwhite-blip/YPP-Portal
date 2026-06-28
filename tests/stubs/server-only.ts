// Empty stub for the `server-only` package so vitest (a Node, non-RSC
// environment) can import modules guarded by `import "server-only"`. Aliased in
// vitest.config.ts. The real package intentionally throws when imported outside
// a React Server Component build, which would otherwise fail test resolution.
export {};
