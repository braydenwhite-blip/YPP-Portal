import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getAllProgramsAdmin,
  getMyPrograms,
  getProgramById,
  getPrograms,
} from "@/lib/program-actions";

describe("program-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses an explicit field select for the public programs list", async () => {
    vi.mocked(prisma.specialProgram.findMany).mockResolvedValue([] as any);

    await getPrograms();

    expect(prisma.specialProgram.findMany).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.specialProgram.findMany).mock.calls[0][0];

    expect(args).toMatchObject({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    expect(args).toHaveProperty("select");
    expect(args).not.toHaveProperty("include");
    expect(args?.select).not.toHaveProperty("isTemplate");
    expect(args?.select?.sessions).toMatchObject({
      orderBy: { scheduledAt: "asc" },
      take: 3,
      select: {
        id: true,
        title: true,
        description: true,
        scheduledAt: true,
        duration: true,
        meetingLink: true,
      },
    });
  });

  it("uses an explicit field select for the program detail page", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as any);
    vi.mocked(prisma.specialProgram.findUnique).mockResolvedValue({
      participants: [{ id: "enrollment-1", userId: "user-1" }],
    } as any);

    const result = await getProgramById("program-1");

    expect(prisma.specialProgram.findUnique).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.specialProgram.findUnique).mock.calls[0][0];

    expect(args).toMatchObject({
      where: { id: "program-1" },
    });
    expect(args).toHaveProperty("select");
    expect(args?.select).not.toHaveProperty("isTemplate");
    expect(args?.select?.participants).toMatchObject({
      where: { userId: "user-1" },
      select: { id: true, userId: true },
    });
    expect(result.isEnrolled).toBe(true);
  });

  it("uses an explicit field select for enrolled programs", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as any);
    vi.mocked(prisma.specialProgramEnrollment.findMany).mockResolvedValue([] as any);

    await getMyPrograms();

    expect(prisma.specialProgramEnrollment.findMany).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.specialProgramEnrollment.findMany).mock.calls[0][0];

    expect(args).toMatchObject({
      where: { userId: "user-1" },
      orderBy: { enrolledAt: "desc" },
    });
    expect(args).toHaveProperty("select");
    expect(args?.select?.program?.select).not.toHaveProperty("isTemplate");
    expect(args?.select?.program?.select?.sessions).toMatchObject({
      orderBy: { scheduledAt: "asc" },
      take: 3,
    });
  });

  it("uses an explicit field select for the admin programs list", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      roles: [{ role: "ADMIN" }],
    } as any);
    vi.mocked(prisma.specialProgram.findMany).mockResolvedValue([] as any);

    await getAllProgramsAdmin();

    expect(prisma.specialProgram.findMany).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.specialProgram.findMany).mock.calls[0][0];

    expect(args).toMatchObject({
      orderBy: { createdAt: "desc" },
    });
    expect(args).toHaveProperty("select");
    expect(args).not.toHaveProperty("include");
    expect(args?.select).not.toHaveProperty("isTemplate");
    expect(args?.select?.sessions).toMatchObject({
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        scheduledAt: true,
        duration: true,
        meetingLink: true,
      },
    });
  });
});
