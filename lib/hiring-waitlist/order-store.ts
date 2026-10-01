import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { prisma } from "@/lib/prisma";

const SETTING_KEY = "hiringWaitlistOrder";
const DATA_PATH = path.join(process.cwd(), "data", "hiring-waitlist-order.json");

type OrderFile = {
  /** Explicit hire order — first key is next to hire. */
  order: string[];
};

function normalizeOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === "string" && k.length > 0);
}

function orderFromJson(value: unknown): string[] | null {
  if (!value || typeof value !== "object") return null;
  const order = (value as { order?: unknown }).order;
  if (!Array.isArray(order)) return null;
  return normalizeOrder(order);
}

async function readFileStore(): Promise<OrderFile> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as OrderFile;
    return { order: normalizeOrder(parsed.order) };
  } catch {
    return { order: [] };
  }
}

async function writeFileStore(data: OrderFile): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Hire-queue order. Production uses PortalSetting (DB) because Vercel’s
 * filesystem is read-only — writing `data/*.json` throws and used to crash
 * the waitlist page on every load.
 */
export async function getHiringWaitlistOrder(): Promise<string[]> {
  try {
    const row = await prisma.portalSetting.findUnique({
      where: { key: SETTING_KEY },
      select: { value: true },
    });
    const fromDb = orderFromJson(row?.value);
    if (fromDb) return fromDb;
  } catch (err) {
    console.warn("[hiring-waitlist] DB order read failed; trying file fallback", err);
  }

  return (await readFileStore()).order;
}

export async function setHiringWaitlistOrder(order: string[]): Promise<void> {
  const cleaned = [...new Set(normalizeOrder(order))];
  const value = { order: cleaned };

  try {
    await prisma.portalSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value },
      update: { value },
    });
    return;
  } catch (err) {
    console.warn("[hiring-waitlist] DB order write failed; trying file fallback", err);
  }

  // Local/dev fallback only — never throw so waitlist load/reorder degrade
  // gracefully on read-only hosts.
  try {
    await writeFileStore({ order: cleaned });
  } catch (err) {
    console.error("[hiring-waitlist] Could not persist order", err);
  }
}

/** Append a waitlisted applicant to the end of the hire queue (idempotent). */
export async function appendHiringWaitlistKey(key: string): Promise<void> {
  const saved = await getHiringWaitlistOrder();
  if (saved.includes(key)) return;
  await setHiringWaitlistOrder([...saved, key]);
}

export { mergeWaitlistOrder } from "./merge-order";
