import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(public)/login/page";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const searchParamState = vi.hoisted(() => ({
  value: "",
}));

const supabaseClientMocks = vi.hoisted(() => ({
  createBrowserClientOrNull: vi.fn(),
}));

const supabaseConfigMocks = vi.hoisted(() => ({
  canUseLocalPasswordFallback: vi.fn(),
  SUPABASE_PUBLIC_ENV_MISSING_MESSAGE:
    "Supabase public auth is not configured in this environment yet.",
}));

const legacyConfigMocks = vi.hoisted(() => ({
  isLegacyAuthBypassEmail: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  navigateToAuthDestination: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams(searchParamState.value),
}));

vi.mock("@/components/brand-lockup", () => ({
  default: () => <div>Brand</div>,
}));

vi.mock("@/lib/supabase/client", () => supabaseClientMocks);
vi.mock("@/lib/supabase/config", () => supabaseConfigMocks);
vi.mock("@/lib/legacy-auth-config", () => legacyConfigMocks);
vi.mock("@/lib/auth-client-navigation", () => navigationMocks);

describe("LoginPage", () => {
  beforeEach(() => {
    searchParamState.value = "";
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
    routerMocks.replace.mockReset();
    supabaseClientMocks.createBrowserClientOrNull.mockReset().mockReturnValue(null);
    supabaseConfigMocks.canUseLocalPasswordFallback.mockReset().mockReturnValue(true);
    legacyConfigMocks.isLegacyAuthBypassEmail.mockReset().mockReturnValue(false);
    navigationMocks.navigateToAuthDestination.mockReset();
    vi.restoreAllMocks();
  });

  it("shows the local fallback notice and disables Supabase-only auth actions", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(/Supabase public auth is missing in this local environment/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Magic Link" })).toBeDisabled();
  });

  it("uses the local password route and navigates after a successful fallback login", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "e2e.instructor.blocked.alpha@ypp.test");
    await user.type(screen.getByLabelText("Password"), "CodexE2E!2026");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/local-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "e2e.instructor.blocked.alpha@ypp.test",
          password: "CodexE2E!2026",
        }),
      });
      expect(navigationMocks.navigateToAuthDestination).toHaveBeenCalledWith("/");
    });
  });
});
