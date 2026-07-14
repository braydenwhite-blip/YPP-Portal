import { expect, type Browser, type BrowserContext, type Page, test as base } from "@playwright/test";
import { signQaRole } from "@/lib/qa-auth-harness";

export type QaRole = "student" | "guardian" | "instructor" | "chapter-president" | "leadership" | "restricted-safety-staff";

export async function createQaContext(browser: Browser, role: QaRole): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addCookies([{
    name: "ypp_qa_role",
    value: signQaRole(role),
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
  }]);
  const page = await context.newPage();
  const response = await page.request.post("/api/qa/session", { data: { role } });
  expect([200, 404]).toContain(response.status());
  await page.close();
  return context;
}

export async function qaPage(browser: Browser, role: QaRole): Promise<Page> {
  const context = await createQaContext(browser, role);
  const page = await context.newPage();
  return page;
}

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/session-7/${name}.png`, fullPage: true });
}

export const test = base.extend<{ rolePage: (role: QaRole) => Promise<Page> }>({
  rolePage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role) => {
      const context = await createQaContext(browser, role);
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});
