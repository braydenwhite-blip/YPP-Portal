import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Entity360Provider } from "@/components/operations/entity-360-drawer";
import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import type { Entity360 } from "@/lib/operations/entity-360";

function entity(overrides: Partial<Entity360> = {}): Entity360 {
  return {
    type: "person",
    id: "u1",
    title: "Brayden Kim",
    subtitle: "Director, Core Instruction",
    typeLabel: "Person",
    status: { label: "Active", tone: "success" },
    meta: "Active · 8 months",
    initials: "BK",
    avatarUrl: null,
    pageHref: "/people/u1",
    facts: [{ label: "Email", value: "brayden@ypp.org", href: "mailto:brayden@ypp.org" }],
    people: [
      { id: "u2", name: "Ian Chen", title: "Chapter President", relationship: "Mentor" },
    ],
    classes: [
      {
        id: "c1",
        title: "Introduction to Entrepreneurship",
        context: "Scarsdale Chapter · Spring 2026 · 14 students",
        status: "In progress",
      },
    ],
    workItems: [],
    meetings: [],
    timeline: [
      {
        id: "person:joined",
        kind: "joined",
        occurredAtISO: "2025-10-01T00:00:00.000Z",
        title: "Joined YPP",
        detail: null,
        actorName: null,
        relatedType: null,
        relatedId: null,
        relatedLabel: null,
        href: null,
      },
    ],
    nextStep: "Finalize instructor interview materials",
    risks: [],
    footnote: "Public view · performance data visible to leadership only",
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    const [, , , type, id] = String(url).split("/");
    const payload =
      id === "u2"
        ? entity({ id: "u2", title: "Ian Chen", subtitle: "Chapter President", people: [] })
        : entity({ type: type as Entity360["type"], id });
    return {
      ok: true,
      json: async () => payload,
    } as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Entity360Provider + EntityLink", () => {
  it("renders plain text when there is no id", () => {
    render(
      <Entity360Provider>
        <EntityLink type="class" id={null}>
          Unknown class
        </EntityLink>
      </Entity360Provider>
    );
    expect(screen.getByText("Unknown class")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to plain navigation links outside a provider", () => {
    render(
      <EntityLink type="class" id="c1">
        Intro to Entrepreneurship
      </EntityLink>
    );
    const link = screen.getByRole("link", { name: "Intro to Entrepreneurship" });
    expect(link).toHaveAttribute("href", "/admin/classes/c1");
  });

  it("opens the 360 panel in place on a plain click", async () => {
    const user = userEvent.setup();
    render(
      <Entity360Provider>
        <EntityLink type="person" id="u1">
          Brayden Kim
        </EntityLink>
      </Entity360Provider>
    );
    await user.click(screen.getByRole("link", { name: "Brayden Kim" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Person: Brayden Kim");
    expect(fetchMock).toHaveBeenCalledWith("/api/entity-360/person/u1");
    // Header identity + sections from the payload.
    expect(screen.getByText("Director, Core Instruction")).toBeInTheDocument();
    expect(screen.getByText("Active · 8 months")).toBeInTheDocument();
    expect(screen.getByText("brayden@ypp.org")).toBeInTheDocument();
    expect(screen.getByText("Ian Chen")).toBeInTheDocument();
    expect(screen.getByText(/Finalize instructor interview materials/)).toBeInTheDocument();
    expect(
      screen.getByText("Public view · performance data visible to leadership only")
    ).toBeInTheDocument();
  });

  it("stacks a second panel from a person row and goes back", async () => {
    const user = userEvent.setup();
    render(
      <Entity360Provider>
        <EntityLink type="person" id="u1">
          Brayden Kim
        </EntityLink>
      </Entity360Provider>
    );
    await user.click(screen.getByRole("link", { name: "Brayden Kim" }));
    await screen.findByRole("dialog");

    // Clicking the mentor opens THEIR panel without leaving the page.
    await user.click(await screen.findByText("Ian Chen"));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Person: Ian Chen")
    );

    // Back returns to the first panel.
    await user.click(screen.getByRole("button", { name: "← Back" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Person: Brayden Kim")
    );
  });

  it("closes on Escape and via the close button", async () => {
    const user = userEvent.setup();
    render(
      <Entity360Provider>
        <EntityLink type="partner" id="p1">
          Beth El Day Camp
        </EntityLink>
      </Entity360Provider>
    );
    await user.click(screen.getByRole("link", { name: "Beth El Day Camp" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps legacy PersonLink working through the compatibility context", async () => {
    const user = userEvent.setup();
    render(
      <Entity360Provider>
        <PersonLink id="u1">Brayden Kim</PersonLink>
      </Entity360Provider>
    );
    await user.click(screen.getByRole("link", { name: "Brayden Kim" }));
    await screen.findByRole("dialog");
    expect(fetchMock).toHaveBeenCalledWith("/api/entity-360/person/u1");
  });

  it("shows a friendly message when the record is not available", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const user = userEvent.setup();
    render(
      <Entity360Provider>
        <EntityLink type="action" id="missing">
          Ghost action
        </EntityLink>
      </Entity360Provider>
    );
    await user.click(screen.getByRole("link", { name: "Ghost action" }));
    expect(await screen.findByText("This record isn't available.")).toBeInTheDocument();
  });
});
