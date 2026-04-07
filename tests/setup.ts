import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    pathname: "/",
    query: {},
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Headers()),
}));

// Mock Supabase Auth
vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(() => null),
  getSessionUser: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({ data: { user: null }, error: null })),
    },
  })),
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        updateUserById: vi.fn(),
        listUsers: vi.fn(),
        generateLink: vi.fn(),
      },
    },
  })),
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userRole: {
      upsert: vi.fn(),
    },
    userProfile: {
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    parentStudent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    chapter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    classOffering: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
    },
    mentorship: {
      findFirst: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
    },
  },
}));

// Set up environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
