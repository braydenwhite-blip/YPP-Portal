import "dotenv/config";

import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

type LegacyMentorshipStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
type CanonicalActionStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";

type LegacyMentorshipAction = {
  id: string;
  mentorshipId: string | null;
  menteeId: string;
  sessionId: string | null;
  session: {
    id: string;
    mentorshipId: string | null;
    menteeId: string;
  } | null;
  title: string;
  details: string | null;
  status: LegacyMentorshipStatus;
  ownerId: string | null;
  createdById: string;
  dueAt: Date | null;
  completedAt: Date | null;
  linkedActionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ActionLookup = {
  id: string;
  status?: string | null;
};

type ActionCreateData = {
  title: string;
  description: string | null;
  status: CanonicalActionStatus;
  priority: "MEDIUM";
  deadlineStart: Date;
  completedAt: Date | null;
  visibility: "ALL_LEADERSHIP";
  leadId: string;
  createdById: string;
  relatedEntityType: "MENTORSHIP";
  relatedEntityId: string;
  sourceType: "ENTITY";
  sourceId: string;
  mentorshipSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignments: {
    create: Array<{
      userId: string;
      role: "LEAD" | "EXECUTING";
      createdAt: Date;
    }>;
  };
};

type FindFirstActionArgs = {
  where: Record<string, unknown>;
  select: { id: true };
};

type FindManyMentorshipActionArgs = {
  take: number;
  orderBy: { id: "asc" };
  cursor?: { id: string };
  skip?: number;
  include: {
    session: {
      select: {
        id: true;
        mentorshipId: true;
        menteeId: true;
      };
    };
  };
};

export type BackfillTransactionClient = {
  mentorshipActionItem: {
    update(args: {
      where: { id: string };
      data: { linkedActionId: string };
    }): Promise<unknown>;
  };
  actionItem: {
    create(args: {
      data: ActionCreateData;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

export type BackfillPrismaClient = BackfillTransactionClient & {
  mentorshipActionItem: BackfillTransactionClient["mentorshipActionItem"] & {
    findMany(args: FindManyMentorshipActionArgs): Promise<LegacyMentorshipAction[]>;
  };
  actionItem: BackfillTransactionClient["actionItem"] & {
    findUnique(args: {
      where: { id: string };
      select: { id: true; status: true };
    }): Promise<ActionLookup | null>;
    findFirst(args: FindFirstActionArgs): Promise<ActionLookup | null>;
  };
  $transaction<T>(
    fn: (tx: BackfillTransactionClient) => Promise<T>
  ): Promise<T>;
};

export type BackfillOptions = {
  apply?: boolean;
  batchSize?: number;
};

export type BackfillProblem = {
  legacyId: string;
  title: string;
  reason: string;
};

export type BackfillSummary = {
  mode: "dry-run" | "apply";
  recordsScanned: number;
  recordsAlreadyLinked: number;
  recordsCreated: number;
  recordsWouldCreate: number;
  recordsSkipped: number;
  recordsFailed: number;
  ambiguousOwnershipCases: number;
  legacyLinksUpdated: number;
  skipped: BackfillProblem[];
  failed: BackfillProblem[];
};

const DEFAULT_BATCH_SIZE = 100;

const STATUS_MAP: Record<LegacyMentorshipStatus, CanonicalActionStatus> = {
  OPEN: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE",
};

function createEmptySummary(apply: boolean): BackfillSummary {
  return {
    mode: apply ? "apply" : "dry-run",
    recordsScanned: 0,
    recordsAlreadyLinked: 0,
    recordsCreated: 0,
    recordsWouldCreate: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    ambiguousOwnershipCases: 0,
    legacyLinksUpdated: 0,
    skipped: [],
    failed: [],
  };
}

function skip(summary: BackfillSummary, item: LegacyMentorshipAction, reason: string) {
  summary.recordsSkipped += 1;
  summary.skipped.push({ legacyId: item.id, title: item.title, reason });
}

function fail(summary: BackfillSummary, item: LegacyMentorshipAction, reason: string) {
  summary.recordsFailed += 1;
  summary.failed.push({ legacyId: item.id, title: item.title, reason });
}

function toActionData(item: LegacyMentorshipAction): ActionCreateData {
  if (!item.mentorshipId || !item.ownerId) {
    throw new Error("Cannot build canonical action for an unmappable legacy row");
  }

  const completedAt =
    item.status === "COMPLETE"
      ? item.completedAt ?? item.updatedAt
      : null;

  return {
    title: item.title,
    description: item.details,
    status: STATUS_MAP[item.status],
    priority: "MEDIUM",
    deadlineStart: item.dueAt ?? item.createdAt,
    completedAt,
    visibility: "ALL_LEADERSHIP",
    leadId: item.ownerId,
    createdById: item.createdById,
    relatedEntityType: "MENTORSHIP",
    relatedEntityId: item.mentorshipId,
    sourceType: "ENTITY",
    sourceId: item.id,
    mentorshipSessionId: item.sessionId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    assignments: {
      create: [
        { userId: item.ownerId, role: "LEAD", createdAt: item.createdAt },
        { userId: item.ownerId, role: "EXECUTING", createdAt: item.createdAt },
      ],
    },
  };
}

async function findExistingCanonicalAction(
  client: BackfillPrismaClient,
  item: LegacyMentorshipAction
): Promise<{ kind: "source"; id: string } | { kind: "possible-duplicate"; id: string } | null> {
  if (!item.mentorshipId || !item.ownerId) return null;

  const sourceMatch = await client.actionItem.findFirst({
    where: {
      sourceType: "ENTITY",
      sourceId: item.id,
      relatedEntityType: "MENTORSHIP",
      relatedEntityId: item.mentorshipId,
    },
    select: { id: true },
  });
  if (sourceMatch) return { kind: "source", id: sourceMatch.id };

  const possibleDuplicate = await client.actionItem.findFirst({
    where: {
      relatedEntityType: "MENTORSHIP",
      relatedEntityId: item.mentorshipId,
      title: item.title,
      createdById: item.createdById,
      leadId: item.ownerId,
      mentorshipSessionId: item.sessionId,
    },
    select: { id: true },
  });
  if (possibleDuplicate) {
    return { kind: "possible-duplicate", id: possibleDuplicate.id };
  }

  return null;
}

async function processOne(
  client: BackfillPrismaClient,
  item: LegacyMentorshipAction,
  summary: BackfillSummary,
  apply: boolean
) {
  summary.recordsScanned += 1;

  if (item.linkedActionId) {
    const existing = await client.actionItem.findUnique({
      where: { id: item.linkedActionId },
      select: { id: true, status: true },
    });
    if (existing) {
      summary.recordsAlreadyLinked += 1;
      return;
    }
    fail(summary, item, `linkedActionId ${item.linkedActionId} does not point to a live ActionItem`);
    return;
  }

  if (!item.mentorshipId) {
    skip(summary, item, "missing mentorship relationship");
    return;
  }

  if (!item.ownerId) {
    summary.ambiguousOwnershipCases += 1;
    skip(summary, item, "missing owner; cannot choose ActionItem.leadId safely");
    return;
  }

  if (item.sessionId) {
    if (!item.session) {
      fail(summary, item, `sessionId ${item.sessionId} is set but the MentorshipSession is missing`);
      return;
    }
    if (item.session.mentorshipId !== item.mentorshipId || item.session.menteeId !== item.menteeId) {
      fail(summary, item, `sessionId ${item.sessionId} does not belong to the same mentorship/mentee`);
      return;
    }
  }

  const existingCanonical = await findExistingCanonicalAction(client, item);
  if (existingCanonical?.kind === "source") {
    if (apply) {
      await client.mentorshipActionItem.update({
        where: { id: item.id },
        data: { linkedActionId: existingCanonical.id },
      });
    }
    summary.legacyLinksUpdated += 1;
    return;
  }

  if (existingCanonical?.kind === "possible-duplicate") {
    fail(
      summary,
      item,
      `possible existing mentorship ActionItem ${existingCanonical.id}; refusing to guess/link`
    );
    return;
  }

  if (!apply) {
    summary.recordsWouldCreate += 1;
    return;
  }

  const actionData = toActionData(item);
  const created = await client.$transaction(async (tx) => {
    const action = await tx.actionItem.create({
      data: actionData,
      select: { id: true },
    });
    await tx.mentorshipActionItem.update({
      where: { id: item.id },
      data: { linkedActionId: action.id },
    });
    return action;
  });

  summary.recordsCreated += 1;
  summary.legacyLinksUpdated += 1;
  if (!created.id) {
    fail(summary, item, "ActionItem create returned no id");
  }
}

export async function backfillMentorshipActions(
  client: BackfillPrismaClient,
  options: BackfillOptions = {}
): Promise<BackfillSummary> {
  const apply = options.apply === true;
  const batchSize = options.batchSize && options.batchSize > 0
    ? Math.floor(options.batchSize)
    : DEFAULT_BATCH_SIZE;
  const summary = createEmptySummary(apply);
  let cursorId: string | undefined;

  for (;;) {
    const rows = await client.mentorshipActionItem.findMany({
      take: batchSize,
      orderBy: { id: "asc" },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      include: {
        session: {
          select: {
            id: true,
            mentorshipId: true,
            menteeId: true,
          },
        },
      },
    });

    if (rows.length === 0) break;

    for (const item of rows) {
      try {
        await processOne(client, item, summary, apply);
      } catch (error) {
        fail(
          summary,
          item,
          error instanceof Error ? error.message : "unknown backfill failure"
        );
      }
    }

    cursorId = rows[rows.length - 1]?.id;
    if (rows.length < batchSize) break;
  }

  return summary;
}

function parseBatchSize(argv: string[]): number | undefined {
  const raw = argv.find((arg) => arg.startsWith("--batch-size="));
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw.slice("--batch-size=".length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function printBackfillSummary(summary: BackfillSummary) {
  console.log(`\nMentorshipActionItem -> ActionItem backfill (${summary.mode})`);
  console.log(`  records scanned: ${summary.recordsScanned}`);
  console.log(`  records already linked: ${summary.recordsAlreadyLinked}`);
  console.log(`  records created: ${summary.recordsCreated}`);
  console.log(`  records that would be created: ${summary.recordsWouldCreate}`);
  console.log(`  records skipped: ${summary.recordsSkipped}`);
  console.log(`  records failed: ${summary.recordsFailed}`);
  console.log(`  ambiguous ownership cases: ${summary.ambiguousOwnershipCases}`);
  console.log(`  legacy links updated: ${summary.legacyLinksUpdated}`);

  if (summary.skipped.length > 0) {
    console.log("\nSkipped records");
    for (const item of summary.skipped) {
      console.log(`  - ${item.legacyId}: ${item.title} (${item.reason})`);
    }
  }

  if (summary.failed.length > 0) {
    console.log("\nFailed records");
    for (const item of summary.failed) {
      console.log(`  - ${item.legacyId}: ${item.title} (${item.reason})`);
    }
  }

  if (summary.mode === "dry-run") {
    console.log("\nDry run only. Re-run with --apply to write canonical actions.");
  }
}

async function runCli() {
  const apply = process.argv.includes("--apply");
  const batchSize = parseBatchSize(process.argv);
  const prisma = new PrismaClient();

  try {
    const summary = await backfillMentorshipActions(
      prisma as unknown as BackfillPrismaClient,
      { apply, batchSize }
    );
    printBackfillSummary(summary);
    if (summary.recordsFailed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  void runCli();
}
