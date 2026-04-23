import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findMany: vi.fn(),
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(roles: string[]) {
  return {
    user: {
      id: "user-1",
      roles,
    },
  };
}

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    status: "SUBMITTED",
    createdAt: new Date("2025-01-15T10:00:00Z"),
    updatedAt: new Date("2025-01-16T10:00:00Z"),
    legalName: "Jane Doe",
    preferredFirstName: "Jane",
    schoolName: "State University",
    graduationYear: 2026,
    interviewRound: 1,
    interviewScheduledAt: null,
    approvedAt: null,
    rejectedAt: null,
    archivedAt: null,
    lastNotificationError: null,
    applicant: {
      name: "Jane Doe",
      email: "jane@example.com",
      chapter: { name: "Bay Area" },
    },
    reviewer: null,
    applicationReviews: [],
    interviewReviews: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/admin/instructor-applicants/export.csv", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 403 when user is not authenticated", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 when user is not ADMIN or HIRING_CHAIR", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["CHAPTER_PRESIDENT"])
    );

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );
    expect(response.status).toBe(403);
  });

  it("returns CSV with correct content-type and content-disposition for ADMIN", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([
      makeApp(),
    ]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");

    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toMatch(/filename="instructor-applicants-\d{4}-\d{2}-\d{2}\.csv"/);
  });

  it("returns CSV with correct content-type for HIRING_CHAIR", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["HIRING_CHAIR"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");
  });

  it("renders a data row with expected fields", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([
      makeApp({
        id: "app-123",
        status: "UNDER_REVIEW",
        legalName: "Alice Smith",
        preferredFirstName: "Alice",
        schoolName: "Tech College",
        graduationYear: 2027,
        applicationReviews: [{ id: "r1" }, { id: "r2" }],
        interviewReviews: [{ id: "ir1" }],
        applicant: {
          name: "Alice Smith",
          email: "alice@example.com",
          chapter: { name: "Seattle" },
        },
        reviewer: { name: "Bob Admin", email: "bob@ypp.org" },
        lastNotificationError: null,
      }),
    ]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );

    const body = await response.text();
    const lines = body.split("\n");

    // Header row
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("status");
    expect(lines[0]).toContain("legalName");
    expect(lines[0]).toContain("reviewerName");

    // Data row
    expect(lines[1]).toContain("app-123");
    expect(lines[1]).toContain("UNDER_REVIEW");
    expect(lines[1]).toContain("Alice Smith");
    expect(lines[1]).toContain("Seattle");
    expect(lines[1]).toContain("Bob Admin");
    expect(lines[1]).toContain("bob@ypp.org");
    // 2 app reviews, 1 interview review
    expect(lines[1]).toContain("2");
    expect(lines[1]).toContain("1");
    // No notification error
    expect(lines[1]).toContain("no");
  });

  it("CSV-escapes fields that contain commas and quotes", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([
      makeApp({
        legalName: 'Smith, "Junior"',
        schoolName: "College of Arts, Sciences",
        applicant: {
          name: 'Smith, "Junior"',
          email: "comma@example.com",
          chapter: { name: "New York, NY" },
        },
        reviewer: null,
      }),
    ]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );

    const body = await response.text();

    // Fields with commas/quotes must be quoted and inner quotes doubled
    expect(body).toContain('"Smith, ""Junior"""');
    expect(body).toContain('"College of Arts, Sciences"');
    expect(body).toContain('"New York, NY"');
  });

  it("passes status filter to prisma query", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    await GET(
      new Request(
        "http://localhost/api/admin/instructor-applicants/export.csv?status=UNDER_REVIEW"
      )
    );

    expect(
      (prisma as any).instructorApplication.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "UNDER_REVIEW" }),
      })
    );
  });

  it("ignores invalid status param", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    await GET(
      new Request(
        "http://localhost/api/admin/instructor-applicants/export.csv?status=INVALID_STATUS"
      )
    );

    // status should not be included in the where clause
    expect(
      (prisma as any).instructorApplication.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ status: "INVALID_STATUS" }),
      })
    );
  });

  it("shows notificationError as yes when lastNotificationError is set", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSession(["ADMIN"])
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).instructorApplication.findMany.mockResolvedValue([
      makeApp({ lastNotificationError: "SMTP connection refused" }),
    ]);

    const { GET } = await import(
      "@/app/api/admin/instructor-applicants/export.csv/route"
    );
    const response = await GET(
      new Request("http://localhost/api/admin/instructor-applicants/export.csv")
    );

    const body = await response.text();
    // data row should contain "yes" for the notification error column (not the error text)
    expect(body).toContain("yes");
    expect(body).not.toContain("SMTP connection refused");
  });
});
