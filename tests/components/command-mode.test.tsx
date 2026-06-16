import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CalmOnly,
  CommandModeProvider,
  CommandModeToggle,
  ExecutiveOnly,
  useCommandMode,
  useIsExecutive,
} from "@/components/command-center/command-mode";
import {
  COMMAND_MODE_COOKIE,
  COMMAND_MODE_STORAGE_KEY,
} from "@/lib/command-mode-cookie";

/** A tiny consumer that reports the current mode, wherever it is mounted. */
function ModeProbe({ label = "probe" }: { label?: string }) {
  const { mode } = useCommandMode();
  const executive = useIsExecutive();
  return (
    <div>
      <span data-testid={`${label}-mode`}>{mode}</span>
      <span data-testid={`${label}-exec`}>{executive ? "yes" : "no"}</span>
    </div>
  );
}

function clearPersistence() {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
  document.cookie = `${COMMAND_MODE_COOKIE}=; path=/; max-age=0`;
}

beforeEach(clearPersistence);
afterEach(clearPersistence);

describe("CommandModeProvider — global view mode", () => {
  it("defaults to Calm when nothing is saved", () => {
    render(
      <CommandModeProvider>
        <ModeProbe />
      </CommandModeProvider>
    );
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("calm");
    expect(screen.getByTestId("probe-exec")).toHaveTextContent("no");
  });

  it("renders the server-supplied initialMode on the first paint (no flash)", () => {
    render(
      <CommandModeProvider initialMode="executive">
        <ModeProbe />
      </CommandModeProvider>
    );
    // Executive shows immediately — there is no Calm frame to flash through.
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("executive");
  });

  it("switches to Executive and persists to both localStorage and the cookie", () => {
    render(
      <CommandModeProvider>
        <CommandModeToggle />
        <ModeProbe />
      </CommandModeProvider>
    );
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("calm");

    fireEvent.click(screen.getByRole("radio", { name: "Executive" }));

    expect(screen.getByTestId("probe-mode")).toHaveTextContent("executive");
    expect(window.localStorage.getItem(COMMAND_MODE_STORAGE_KEY)).toBe("executive");
    expect(document.cookie).toContain(`${COMMAND_MODE_COOKIE}=executive`);
  });

  it("adopts a returning visitor's saved choice from localStorage when no cookie was sent", () => {
    window.localStorage.setItem(COMMAND_MODE_STORAGE_KEY, "executive");
    render(
      <CommandModeProvider>
        <ModeProbe />
      </CommandModeProvider>
    );
    // The mount effect reconciles to the stored preference.
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("executive");
  });

  it("shares ONE source of truth: a nested provider defers to the parent (no drift)", () => {
    render(
      <CommandModeProvider initialMode="calm">
        <CommandModeToggle />
        {/* A surface that still wraps itself in a provider must NOT fork state. */}
        <CommandModeProvider>
          <ModeProbe label="nested" />
        </CommandModeProvider>
      </CommandModeProvider>
    );

    expect(screen.getByTestId("nested-mode")).toHaveTextContent("calm");
    fireEvent.click(screen.getByRole("radio", { name: "Executive" }));
    // The nested consumer reflects the parent change — single shared state.
    expect(screen.getByTestId("nested-mode")).toHaveTextContent("executive");
  });

  it("keeps two toggles in sync across the tree (e.g. top bar + a page header)", () => {
    render(
      <CommandModeProvider>
        <div data-testid="bar">
          <CommandModeToggle />
        </div>
        <div data-testid="page">
          <CommandModeToggle />
        </div>
        <ModeProbe />
      </CommandModeProvider>
    );
    const execButtons = screen.getAllByRole("radio", { name: "Executive" });
    expect(execButtons).toHaveLength(2);

    // Flip from the page header toggle…
    fireEvent.click(execButtons[1]);
    // …both pills and the probe agree.
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("executive");
    for (const btn of screen.getAllByRole("radio", { name: "Executive" })) {
      expect(btn).toHaveAttribute("aria-checked", "true");
    }
  });

  it("ExecutiveOnly / CalmOnly render the right branch for the active mode", () => {
    render(
      <CommandModeProvider initialMode="calm">
        <CommandModeToggle />
        <CalmOnly>
          <span>calm-content</span>
        </CalmOnly>
        <ExecutiveOnly>
          <span>executive-content</span>
        </ExecutiveOnly>
      </CommandModeProvider>
    );
    expect(screen.getByText("calm-content")).toBeInTheDocument();
    expect(screen.queryByText("executive-content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Executive" }));
    expect(screen.queryByText("calm-content")).not.toBeInTheDocument();
    expect(screen.getByText("executive-content")).toBeInTheDocument();
  });

  it("syncs across tabs via the storage event", () => {
    render(
      <CommandModeProvider>
        <ModeProbe />
      </CommandModeProvider>
    );
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("calm");

    act(() => {
      window.localStorage.setItem(COMMAND_MODE_STORAGE_KEY, "executive");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: COMMAND_MODE_STORAGE_KEY,
          newValue: "executive",
        })
      );
    });
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("executive");
  });
});
