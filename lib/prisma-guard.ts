import { Prisma } from "@prisma/client";

const RECOVERABLE_PRISMA_CODES = new Set(["P2010", "P2021", "P2022"]);

const RECOVERABLE_MESSAGE_PARTS = [
  "does not exist in the current database",
  "does not exist",
  "invalid input value for enum",
  "Error in connector",
];

type FallbackFactory<T> = T | (() => T);

function messageLooksRecoverable(message: string): boolean {
  const normalized = message.toLowerCase();
  return RECOVERABLE_MESSAGE_PARTS.some((part) =>
    normalized.includes(part.toLowerCase())
  );
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : null;
}

export function isRecoverablePrismaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (RECOVERABLE_PRISMA_CODES.has(error.code)) return true;
    return messageLooksRecoverable(error.message);
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return messageLooksRecoverable(error.message);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Error) {
    if (messageLooksRecoverable(error.message)) return true;
  }

  const code = readErrorCode(error);
  if (code && RECOVERABLE_PRISMA_CODES.has(code)) return true;

  return false;
}

function resolveFallback<T>(fallback: FallbackFactory<T>): T {
  return typeof fallback === "function"
    ? (fallback as () => T)()
    : fallback;
}

export async function withPrismaFallback<T>(
  scope: string,
  run: () => Promise<T>,
  fallback: FallbackFactory<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isRecoverablePrismaError(error)) {
      throw error;
    }

    console.error(
      `[${scope}] Recoverable Prisma error; using fallback value.`,
      error
    );
    return resolveFallback(fallback);
  }
}
