import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const password = process.env.E2E_SEED_PASSWORD ?? "CodexE2E!2026";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const auditLabel = process.env.MENTORSHIP_AUDIT_LABEL ?? "baseline";
const outputDir = resolve(process.cwd(), `test-results/mentorship-audit/${auditLabel}`);
const viewport = {
  width: Number(process.env.MENTORSHIP_AUDIT_WIDTH ?? 1440),
  height: Number(process.env.MENTORSHIP_AUDIT_HEIGHT ?? 1000),
};
const requestedRoles = new Set(
  (process.env.MENTORSHIP_AUDIT_ROLES ?? "admin,mentor,mentee,chair,committee")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
);

await mkdir(outputDir, { recursive: true });

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  where: {
    email: {
      in: [
        "e2e.admin@ypp.test",
        "e2e.chapter.lead.alpha@ypp.test",
        "e2e.mentor.alpha@ypp.test",
        "e2e.instructor.ready.alpha@ypp.test",
        "e2e.chair.instructor@ypp.test",
        "e2e.committee.instructor@ypp.test",
        "e2e.mentee.quarterly@ypp.test",
      ],
    },
  },
  select: { id: true, email: true },
});
const ids = Object.fromEntries(users.map((user) => [user.email, user.id]));

const browser = await chromium.launch({ headless: true, executablePath });
const report = [];

async function captureRole({ key, email, routes }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  console.log(`[audit] ${key}: login`);
  const loginResponse = await context.request.post(`${baseURL}/api/auth/local-password`, {
    data: { email, password },
  });
  if (!loginResponse.ok()) {
    throw new Error(`[audit] ${key}: login failed with ${loginResponse.status()}`);
  }
  console.log(`[audit] ${key}: authenticated`);

  for (const [name, route] of Object.entries(routes)) {
    console.log(`[audit] ${key}: ${name} ${route}`);
    await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await page.screenshot({
      path: resolve(outputDir, `${key}-${name}.png`),
      fullPage: true,
    });

    report.push({
      role: key,
      page: name,
      requestedRoute: route,
      finalUrl: page.url(),
      title: await page.title(),
      headingCount: await page.getByRole("heading").count(),
      visibleTextLength: (await page.locator("body").innerText()).trim().length,
      hasErrorOverlay: await page
        .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
        .count(),
    });
  }

  report.push({ role: key, consoleErrors, pageErrors });
  await context.close();
}

try {
  const roleAudits = [
    {
    key: "admin",
    email: "e2e.admin@ypp.test",
    routes: {
      hub: "/mentorship?view=admin",
      person: `/mentorship/people/${ids["e2e.instructor.ready.alpha@ypp.test"]}`,
    },
    },
    {
    key: "mentor",
    email: "e2e.mentor.alpha@ypp.test",
    routes: {
      hub: "/mentorship",
      person: `/mentorship/people/${ids["e2e.instructor.ready.alpha@ypp.test"]}`,
    },
    },
    {
    key: "mentee",
    email: "e2e.instructor.ready.alpha@ypp.test",
    routes: {
      hub: "/mentorship",
      self: `/mentorship/people/${ids["e2e.instructor.ready.alpha@ypp.test"]}`,
    },
    },
    {
      key: "chair",
      email: "e2e.chair.instructor@ypp.test",
      routes: {
        hub: "/mentorship",
        person: `/mentorship/people/${ids["e2e.instructor.ready.alpha@ypp.test"]}`,
      },
    },
    {
      key: "committee",
      email: "e2e.committee.instructor@ypp.test",
      routes: {
        hub: "/mentorship",
        person: `/mentorship/people/${ids["e2e.mentee.quarterly@ypp.test"]}`,
      },
    },
  ];

  for (const audit of roleAudits) {
    if (requestedRoles.has(audit.key)) await captureRole(audit);
  }
} finally {
  await writeFile(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await prisma.$disconnect();
}

console.log(JSON.stringify(report, null, 2));
