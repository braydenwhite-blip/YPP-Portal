/**
 * Unit tests for the curriculum import pipeline.
 *
 * Uses a hand-crafted minimal CurriculumDefinition and an in-memory mock of
 * PrismaClient. No real DB connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Minimal beat config schemas for the test (mirrors real SCENARIO_CHOICE shape)
// ---------------------------------------------------------------------------

const FEEDBACK_SCHEMA = z.object({
  tone: z.enum(["correct", "partial", "incorrect", "noted"]),
  headline: z.string(),
  body: z.string(),
});

const SCENARIO_CHOICE_CONFIG_SCHEMA = z
  .object({
    options: z.array(z.object({ id: z.string(), label: z.string() })).min(3).max(5),
    correctOptionId: z.string(),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
  })
  .superRefine((val, ctx) => {
    const ids = new Set(val.options.map((o) => o.id));
    if (!ids.has(val.correctOptionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bad correctOptionId", path: ["correctOptionId"] });
    }
    if (!("default" in val.incorrectFeedback)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'missing "default"', path: ["incorrectFeedback"] });
    }
  });

const CONCEPT_REVEAL_CONFIG_SCHEMA = z.object({
  panels: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })).min(2).max(6),
  correctFeedback: FEEDBACK_SCHEMA,
});

const BEAT_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  SCENARIO_CHOICE: SCENARIO_CHOICE_CONFIG_SCHEMA,
  CONCEPT_REVEAL: CONCEPT_REVEAL_CONFIG_SCHEMA,
};

const BEAT_SCHEMA_VERSIONS: Record<string, number> = {
  SCENARIO_CHOICE: 1,
  CONCEPT_REVEAL: 1,
};

// ---------------------------------------------------------------------------
// Minimal valid curriculum fixture
// ---------------------------------------------------------------------------

const VALID_SCENARIO_CHOICE_CONFIG = {
  options: [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
    { id: "c", label: "Option C" },
  ],
  correctOptionId: "a",
  correctFeedback: { tone: "correct" as const, headline: "Great!", body: "Correct answer." },
  incorrectFeedback: {
    default: { tone: "incorrect" as const, headline: "Oops", body: "Try again." },
  },
};

const VALID_CONCEPT_REVEAL_CONFIG = {
  panels: [
    { id: "p1", title: "Panel 1", body: "Content 1" },
    { id: "p2", title: "Panel 2", body: "Content 2" },
  ],
  correctFeedback: { tone: "correct" as const, headline: "Done!", body: "All panels visited." },
};

function makeMinimalCurriculum() {
  return {
    contentKey: "test/m1-ypp-standard",
    module: {
      title: "Test Module",
      description: "Test description",
      sortOrder: 1,
      required: true,
      passScorePct: 80,
    },
    journey: {
      estimatedMinutes: 20,
      strictMode: false,
      version: 1,
    },
    beats: [
      {
        sourceKey: "test/beat-01-concept",
        sortOrder: 1,
        kind: "CONCEPT_REVEAL" as const,
        title: "Beat 1",
        prompt: "Read all panels.",
        config: VALID_CONCEPT_REVEAL_CONFIG,
        scoringWeight: 0,
      },
      {
        sourceKey: "test/beat-02-scenario",
        sortOrder: 2,
        kind: "SCENARIO_CHOICE" as const,
        title: "Beat 2",
        prompt: "Pick the right option.",
        config: VALID_SCENARIO_CHOICE_CONFIG,
        scoringWeight: 10,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Build a mock Prisma client
// ---------------------------------------------------------------------------

type MockBeat = {
  id: string;
  sourceKey: string;
  sortOrder: number;
  removedAt: Date | null;
};

function buildMockPrisma(opts: {
  existingModule?: { id: string } | null;
  existingJourney?: { id: string } | null;
  existingBeats?: MockBeat[];
} = {}) {
  const {
    existingModule = null,
    existingJourney = null,
    existingBeats = [],
  } = opts;

  // Track upserted beats for idempotency checks
  const upsertedBeats: Record<string, MockBeat> = {};
  for (const b of existingBeats) {
    upsertedBeats[b.sourceKey] = { ...b };
  }

  const updateManyCalls: { where: unknown; data: unknown }[] = [];
  const createCalls: unknown[] = [];
  const updateCalls: unknown[] = [];

  const txProxy = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    trainingModule: {
      findUnique: vi.fn().mockResolvedValue(existingModule),
      create: vi.fn().mockImplementation(async ({ data }: { data: { contentKey: string } }) => {
        createCalls.push({ table: "trainingModule", data });
        return { id: "module-id-1" };
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
        updateCalls.push({ table: "trainingModule", data });
        return {};
      }),
    },
    interactiveJourney: {
      findUnique: vi.fn().mockResolvedValue(existingJourney),
      create: vi.fn().mockResolvedValue({ id: "journey-id-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    interactiveBeat: {
      findMany: vi.fn().mockResolvedValue(existingBeats),
      create: vi.fn().mockImplementation(async ({ data }: { data: { sourceKey: string; sortOrder: number } }) => {
        createCalls.push({ table: "interactiveBeat", data });
        const id = `beat-${data.sourceKey}`;
        upsertedBeats[data.sourceKey] = { id, sourceKey: data.sourceKey, sortOrder: data.sortOrder, removedAt: null };
        return { id };
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: unknown }) => {
        updateCalls.push({ table: "interactiveBeat", where, data });
        return {};
      }),
      updateMany: vi.fn().mockImplementation(async (args: { where: unknown; data: unknown }) => {
        updateManyCalls.push(args);
        return { count: existingBeats.length };
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txProxy) => Promise<void>) => {
      return fn(txProxy);
    }),
    _tx: txProxy,
    _updateManyCalls: updateManyCalls,
    _createCalls: createCalls,
    _updateCalls: updateCalls,
    _upsertedBeats: upsertedBeats,
  };

  return prisma;
}

// ---------------------------------------------------------------------------
// Import the function under test
// ---------------------------------------------------------------------------

// Dynamic import at module load time; vitest handles ESM fine.
// We import directly from the mjs helper (not the entry-point script).
const { importCurriculumRegistry } = await import(
  "../../scripts/training-academy-curriculum-import.mjs"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("importCurriculumRegistry", () => {
  describe("1. Idempotency", () => {
    it("run 1 creates module + journey + beats", async () => {
      const prisma = buildMockPrisma();
      const curriculum = makeMinimalCurriculum();

      const counters = await importCurriculumRegistry(prisma, [curriculum], {
        dryRun: false,
        beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
        beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
      });

      expect(counters.journeysCreated).toBe(1);
      expect(counters.journeysUpdated).toBe(0);
      expect(counters.beatsCreated).toBe(2);
      expect(counters.beatsUpdated).toBe(0);
      expect(counters.beatsSoftDeleted).toBe(0);
    });

    it("run 2 (module+journey+beats already exist) produces updates not creates", async () => {
      const existingBeats: MockBeat[] = [
        { id: "beat-test/beat-01-concept", sourceKey: "test/beat-01-concept", sortOrder: 1, removedAt: null },
        { id: "beat-test/beat-02-scenario", sourceKey: "test/beat-02-scenario", sortOrder: 2, removedAt: null },
      ];
      const prisma = buildMockPrisma({
        existingModule: { id: "module-id-1" },
        existingJourney: { id: "journey-id-1" },
        existingBeats,
      });
      const curriculum = makeMinimalCurriculum();

      const counters = await importCurriculumRegistry(prisma, [curriculum], {
        dryRun: false,
        beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
        beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
      });

      // No creates on run 2
      const beatCreateCalls = prisma._createCalls.filter(
        (c: { table: string }) => c.table === "interactiveBeat"
      );
      expect(beatCreateCalls).toHaveLength(0);
      expect(counters.beatsCreated).toBe(0);
      // Two updates (one per existing beat)
      expect(counters.beatsUpdated).toBe(2);
      expect(counters.journeysCreated).toBe(0);
      expect(counters.journeysUpdated).toBe(1);
    });
  });

  describe("2. Orphan soft-delete", () => {
    it("sets removedAt on beats not in incoming set", async () => {
      const existingBeats: MockBeat[] = [
        { id: "beat-test/beat-01-concept", sourceKey: "test/beat-01-concept", sortOrder: 1, removedAt: null },
        { id: "beat-test/beat-02-scenario", sourceKey: "test/beat-02-scenario", sortOrder: 2, removedAt: null },
        // orphan — not in curriculum
        { id: "beat-orphan", sourceKey: "test/orphan-beat", sortOrder: 3, removedAt: null },
      ];
      const prisma = buildMockPrisma({
        existingModule: { id: "module-id-1" },
        existingJourney: { id: "journey-id-1" },
        existingBeats,
      });
      const curriculum = makeMinimalCurriculum();

      const counters = await importCurriculumRegistry(prisma, [curriculum], {
        dryRun: false,
        beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
        beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
      });

      expect(counters.beatsSoftDeleted).toBe(1);

      // The orphan updateMany call must set removedAt and match the orphan id
      const softDeleteCall = prisma._updateManyCalls.find(
        (c: { data: { removedAt?: unknown } }) => c.data?.removedAt instanceof Date
      );
      expect(softDeleteCall).toBeDefined();
      expect((softDeleteCall?.where as { id: { in: string[] } })?.id?.in).toContain("beat-orphan");
    });

    it("does NOT call InteractiveBeatAttempt.deleteMany", async () => {
      const existingBeats: MockBeat[] = [
        { id: "beat-orphan", sourceKey: "test/orphan-beat", sortOrder: 3, removedAt: null },
      ];
      const prisma = buildMockPrisma({
        existingModule: { id: "module-id-1" },
        existingJourney: { id: "journey-id-1" },
        existingBeats,
      });
      // Spy to confirm deleteMany was never set up
      const deleteManyMock = vi.fn();
      (prisma as unknown as { _tx: { interactiveBeatAttempt?: { deleteMany: typeof deleteManyMock } } })._tx.interactiveBeatAttempt = { deleteMany: deleteManyMock };

      const curriculum = makeMinimalCurriculum();
      await importCurriculumRegistry(prisma, [curriculum], {
        dryRun: false,
        beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
        beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
      });

      expect(deleteManyMock).not.toHaveBeenCalled();
    });
  });

  describe("3. Invalid config rejected", () => {
    it("throws with sourceKey and kind when config fails Zod parse", async () => {
      const prisma = buildMockPrisma();

      const badCurriculum = {
        ...makeMinimalCurriculum(),
        beats: [
          {
            sourceKey: "test/bad-beat",
            sortOrder: 1,
            kind: "SCENARIO_CHOICE" as const,
            title: "Bad Beat",
            prompt: "Bad config.",
            config: {
              // missing required fields
              options: [],
              correctOptionId: "x",
            },
            scoringWeight: 10,
          },
        ],
      };

      await expect(
        importCurriculumRegistry(prisma, [badCurriculum], {
          dryRun: false,
          beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
          beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
        })
      ).rejects.toThrow(/sourceKey="test\/bad-beat"/);

      await expect(
        importCurriculumRegistry(prisma, [badCurriculum], {
          dryRun: false,
          beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
          beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
        })
      ).rejects.toThrow(/kind="SCENARIO_CHOICE"/);
    });

    it("does not make DB writes when config is invalid (throws before transaction)", async () => {
      const prisma = buildMockPrisma();

      const badCurriculum = {
        ...makeMinimalCurriculum(),
        beats: [
          {
            sourceKey: "test/invalid-beat",
            sortOrder: 1,
            kind: "SCENARIO_CHOICE" as const,
            title: "Invalid",
            prompt: "Invalid.",
            config: { wrong: "shape" },
            scoringWeight: 10,
          },
        ],
      };

      await expect(
        importCurriculumRegistry(prisma, [badCurriculum], {
          dryRun: false,
          beatConfigSchemas: BEAT_CONFIG_SCHEMAS,
          beatSchemaVersions: BEAT_SCHEMA_VERSIONS,
        })
      ).rejects.toThrow();

      // $transaction should NOT have been called (validation throws before it)
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
