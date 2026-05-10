import { describe, expect, it } from "vitest";

import {
  BEAT_DEFAULTS,
  EDITOR_SUPPORTED_KINDS,
} from "@/lib/journey-editor/beat-defaults";
import { BEAT_CONFIG_SCHEMAS } from "@/lib/training-journey/schemas";

describe("BEAT_DEFAULTS", () => {
  for (const kind of EDITOR_SUPPORTED_KINDS) {
    it(`provides a default config for ${kind} that parses against BEAT_CONFIG_SCHEMAS`, () => {
      const def = BEAT_DEFAULTS[kind];
      expect(def).toBeDefined();
      const result = BEAT_CONFIG_SCHEMAS[kind].safeParse(def.config);
      if (!result.success) {
        // Surface the issues for easier debugging when this regresses.
        // eslint-disable-next-line no-console
        console.error(`${kind} default issues:`, result.error.issues);
      }
      expect(result.success).toBe(true);
    });
  }
});
