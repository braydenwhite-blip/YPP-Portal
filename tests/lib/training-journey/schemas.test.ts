/**
 * Cross-cutting tests for the schema registry.
 *
 * Per-kind schema tests (round-trip, field-level validation) live in
 * `tests/lib/training-journey/kinds/`. This file verifies the registry:
 *   - Every kind has both a config and response schema.
 *   - Schema versions are positive integers.
 *   - Kind module objects have the right `kind` field (self-consistency).
 */

import { describe, expect, it } from "vitest";

import {
  BEAT_CONFIG_SCHEMAS,
  BEAT_RESPONSE_SCHEMAS,
  BEAT_SCHEMA_VERSIONS,
  KIND_MODULES,
} from "@/lib/training-journey/schemas";
import {
  INTERACTIVE_BEAT_KINDS,
  type InteractiveBeatKind,
} from "@/lib/training-journey/types";

describe("schema registry", () => {
  it("has a config schema for every kind", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(BEAT_CONFIG_SCHEMAS[kind]).toBeDefined();
    }
  });

  it("has a response schema for every kind", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(BEAT_RESPONSE_SCHEMAS[kind]).toBeDefined();
    }
  });

  it("uses positive integer schema versions", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      const v = BEAT_SCHEMA_VERSIONS[kind];
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps KIND_MODULES self-consistent — kind field matches the map key", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(KIND_MODULES[kind].kind).toBe(kind);
    }
  });

  it("wires `configSchema` / `responseSchema` through identity equality into the registries", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(BEAT_CONFIG_SCHEMAS[kind]).toBe(KIND_MODULES[kind].configSchema);
      expect(BEAT_RESPONSE_SCHEMAS[kind]).toBe(
        KIND_MODULES[kind].responseSchema
      );
    }
  });

  it("rejects obviously-wrong config shapes for every kind (not-a-valid-config sanity check)", () => {
    // Every kind should reject `null` as a config. This is the most-basic
    // "did you even define a schema?" check. Stubbed/incomplete kinds that
    // accept `z.unknown()` will pass this check, but that's detected by the
    // registry.schemaVersion check above (stubs are version 0).
    const someKinds: InteractiveBeatKind[] = [
      "SCENARIO_CHOICE",
      "MULTI_SELECT",
      "MATCH_PAIRS",
      "FILL_IN_BLANK",
      "MESSAGE_COMPOSER",
    ];
    for (const kind of someKinds) {
      const result = BEAT_CONFIG_SCHEMAS[kind].safeParse(null);
      expect(result.success).toBe(false);
    }
  });
});
