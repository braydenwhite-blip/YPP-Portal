import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleType } from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { createUser } from "@/lib/admin-actions";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit-log-actions", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/progress-events", () => ({
  onProgressEvent: vi.fn(),
}));

vi.mock("@/lib/supabase-user-migration", () => ({
  migrateUsersToSupabaseAuth: vi.fn(),
}));

describe("admin-actions createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "admin-1",
        roles: ["ADMIN"],
      },
    } as any);
    vi.mocked(logAuditEvent).mockResolvedValue(undefined as any);
  });

  it("creates the Supabase auth user first and stores its id on the Prisma user", async () => {
    const createSupabaseUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
        },
      },
      error: null,
    });

    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          createUser: createSupabaseUser,
          deleteUser: vi.fn(),
        },
      },
    } as any);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "portal-user-1",
      email: "newuser@example.com",
    } as any);

    const formData = new FormData();
    formData.set("name", "New User");
    formData.set("email", "NewUser@Example.com");
    formData.set("password", "Passw0rd123");
    formData.set("primaryRole", RoleType.STUDENT);
    formData.set("chapterId", "chapter-1");

    await createUser(formData);

    expect(createSupabaseUser).toHaveBeenCalledWith({
      email: "newuser@example.com",
      password_hash: expect.any(String),
      email_confirm: true,
      user_metadata: {
        name: "New User",
        primaryRole: RoleType.STUDENT,
        chapterId: "chapter-1",
        roles: [RoleType.STUDENT],
      },
    });
    expect(vi.mocked(prisma.user.create)).toHaveBeenCalledWith({
      data: {
        name: "New User",
        email: "newuser@example.com",
        phone: null,
        passwordHash: expect.any(String),
        primaryRole: RoleType.STUDENT,
        chapterId: "chapter-1",
        emailVerified: expect.any(Date),
        supabaseAuthId: "auth-user-1",
        roles: {
          create: [{ role: RoleType.STUDENT }],
        },
      },
    });
  });

  it("reuses the trigger-created Prisma user row when it already exists after auth creation", async () => {
    const createSupabaseUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
        },
      },
      error: null,
    });

    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          createUser: createSupabaseUser,
          deleteUser: vi.fn(),
        },
      },
    } as any);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "portal-user-1",
        supabaseAuthId: "auth-user-1",
      } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "portal-user-1",
      email: "newuser@example.com",
    } as any);

    const formData = new FormData();
    formData.set("name", "New User");
    formData.set("email", "newuser@example.com");
    formData.set("password", "Passw0rd123");
    formData.set("primaryRole", RoleType.STUDENT);
    formData.append("roles", RoleType.STUDENT);
    formData.append("roles", RoleType.MENTOR);

    await createUser(formData);

    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith({
      where: { id: "portal-user-1" },
      data: {
        name: "New User",
        email: "newuser@example.com",
        phone: null,
        passwordHash: expect.any(String),
        primaryRole: RoleType.STUDENT,
        chapterId: null,
        emailVerified: expect.any(Date),
        supabaseAuthId: "auth-user-1",
        roles: {
          deleteMany: {},
          create: [
            { role: RoleType.STUDENT },
            { role: RoleType.MENTOR },
          ],
        },
        adminSubtypes: {
          deleteMany: {},
        },
      },
    });
  });

  it("adds the admin role automatically when admin subtypes are selected", async () => {
    const createSupabaseUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-2",
        },
      },
      error: null,
    });

    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          createUser: createSupabaseUser,
          deleteUser: vi.fn(),
        },
      },
    } as any);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "portal-user-2",
      email: "adminuser@example.com",
    } as any);

    const formData = new FormData();
    formData.set("name", "Admin User");
    formData.set("email", "adminuser@example.com");
    formData.set("password", "Passw0rd123");
    formData.set("primaryRole", RoleType.STAFF);
    formData.append("roles", RoleType.STAFF);
    formData.append("adminSubtypes", "CONTENT_ADMIN");
    formData.set("defaultOwnerSubtype", "CONTENT_ADMIN");

    await createUser(formData);

    expect(createSupabaseUser).toHaveBeenCalledWith({
      email: "adminuser@example.com",
      password_hash: expect.any(String),
      email_confirm: true,
      user_metadata: {
        name: "Admin User",
        primaryRole: RoleType.STAFF,
        chapterId: null,
        roles: [RoleType.STAFF, RoleType.ADMIN],
      },
    });
    expect(vi.mocked(prisma.user.create)).toHaveBeenCalledWith({
      data: {
        name: "Admin User",
        email: "adminuser@example.com",
        phone: null,
        passwordHash: expect.any(String),
        primaryRole: RoleType.STAFF,
        chapterId: null,
        emailVerified: expect.any(Date),
        supabaseAuthId: "auth-user-2",
        roles: {
          create: [{ role: RoleType.STAFF }, { role: RoleType.ADMIN }],
        },
        adminSubtypes: {
          create: [{ subtype: "CONTENT_ADMIN", isDefaultOwner: true }],
        },
      },
    });
  });

  it("deletes the Supabase auth user if the Prisma create fails", async () => {
    const createSupabaseUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
        },
      },
      error: null,
    });
    const deleteSupabaseUser = vi.fn().mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          createUser: createSupabaseUser,
          deleteUser: deleteSupabaseUser,
        },
      },
    } as any);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("Database write failed"));

    const formData = new FormData();
    formData.set("name", "New User");
    formData.set("email", "newuser@example.com");
    formData.set("password", "Passw0rd123");
    formData.set("primaryRole", RoleType.STUDENT);

    await expect(createUser(formData)).rejects.toThrow("Database write failed");

    expect(deleteSupabaseUser).toHaveBeenCalledWith("auth-user-1");
  });
});
