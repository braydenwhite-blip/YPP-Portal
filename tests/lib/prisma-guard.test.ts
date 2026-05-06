import { describe, it, expect, vi } from "vitest";
import { withPrismaFallback } from "@/lib/prisma-guard";

describe("withPrismaFallback", () => {
  it("returns the run() result when it resolves", async () => {
    const result = await withPrismaFallback(
      "test:happy-path",
      async () => "ok",
      "fallback"
    );
    expect(result).toBe("ok");
  });

  it("returns the fallback when run() throws a recoverable error", async () => {
    const err = new Error("relation does not exist in the current database");
    const result = await withPrismaFallback(
      "test:recoverable",
      async () => {
        throw err;
      },
      "fallback"
    );
    expect(result).toBe("fallback");
  });

  it("supports a lazily-evaluated fallback factory", async () => {
    const factory = vi.fn(() => ({ items: [] as string[] }));
    const result = await withPrismaFallback(
      "test:factory",
      async () => {
        throw new Error("Connection pool timeout");
      },
      factory
    );
    expect(result).toEqual({ items: [] });
    expect(factory).toHaveBeenCalledOnce();
  });

  it("rethrows unrecoverable errors", async () => {
    const boom = new Error("boom");
    await expect(
      withPrismaFallback(
        "test:unrecoverable",
        async () => {
          throw boom;
        },
        "fallback"
      )
    ).rejects.toBe(boom);
  });

  // Regression for the production crash on /applications/summer-workshop:
  // calling withPrismaFallback without the scope string caused `run` to be
  // bound to the (null) fallback, producing "TypeError: b is not a function"
  // in the minified SSR bundle. This test pins the signature contract so the
  // misuse can't sneak back in.
  it("requires the run argument to be callable", async () => {
    await expect(
      withPrismaFallback(
        "test:bad-call",
        // @ts-expect-error — intentionally passing a non-function
        null,
        "fallback"
      )
    ).rejects.toThrow(TypeError);
  });
});
