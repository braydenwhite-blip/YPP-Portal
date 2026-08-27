import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "hiring-waitlist-order.json");

type OrderFile = {
  /** Explicit hire order — first key is next to hire. */
  order: string[];
};

async function readStore(): Promise<OrderFile> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as OrderFile;
    return {
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((k): k is string => typeof k === "string" && k.length > 0)
        : [],
    };
  } catch {
    return { order: [] };
  }
}

async function writeStore(data: OrderFile): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getHiringWaitlistOrder(): Promise<string[]> {
  return (await readStore()).order;
}

export async function setHiringWaitlistOrder(order: string[]): Promise<void> {
  await writeStore({ order: [...new Set(order)] });
}

/** Append a waitlisted applicant to the end of the hire queue (idempotent). */
export async function appendHiringWaitlistKey(key: string): Promise<void> {
  const saved = await getHiringWaitlistOrder();
  if (saved.includes(key)) return;
  await setHiringWaitlistOrder([...saved, key]);
}

export { mergeWaitlistOrder } from "./merge-order";
