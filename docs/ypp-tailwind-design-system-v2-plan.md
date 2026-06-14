# Design System 2.0 — Tailwind Migration Plan (V2 Addendum)

**Status:** Engineering companion to `docs/ypp-organizational-knowledge-os-master-plan.md` §22
**Date:** June 2026
**Decision:** The current CSS layer is a bottleneck. All new and redesigned Knowledge OS surfaces are built on Tailwind CSS v4 + a new `components/ui-v2/` design system. `app/globals.css` is frozen immediately and retired in phases.

**Product/intuitiveness doctrine:** `docs/ypp-global-intuitiveness-design-system.md` is the source of truth for *how pages should feel* — page anatomy, density budget, CTA hierarchy, status language, progressive disclosure, and the "never again" anti-patterns. This file is the *engineering* companion (tokens, primitives, lint guards, migration). Build with both open.

---

## 1. Why the current CSS layer cannot stay

Audited facts:

- `app/globals.css` is ~17,400 lines, imported once at `app/layout.tsx:1`, append-only in practice. There is no scoping, no ownership, no dead-code detection; deleting anything is dangerous, so nothing is deleted.
- Global class semantics drift: `.card` is a table wrapper, a stat tile, a row container, and a panel depending on page; `.button` sizing and `.topbar` usage vary; spacing between equivalent sections ranges 16–48px; inline `style={}` overrides tokens in many components.
- There are **no primitives**: ~404 domain components each hand-roll headers, tabs, drawers, tables, and empty states (three competing empty-state patterns exist today).
- The polish ceiling is structural. Reaching mockup-level finish under this system means hand-tuning every page, and the next page starts from zero. Consistency efforts decay because nothing enforces them.

Conclusion: building the V1 plan's "shared primitives" on top of this layer would inherit all of these failure modes. The foundation changes.

## 2. Technical viability (no serious blocker)

| Check | Finding |
|---|---|
| Framework | Next.js **16** (`^16.2.4`), **Turbopack** configured (`next.config.mjs` → `turbopack.root`). Tailwind v4 is first-class on this stack. (`TECH_STACK.md`'s "Next 14" is stale.) |
| Existing PostCSS pipeline | None — no `postcss.config.*`, no Tailwind config, nothing to conflict with |
| Global CSS entry | Exactly one import (`app/layout.tsx:1`) — clean containment boundary |
| CSS modules | One file (`components/shared/skeleton.module.css`) — no conflict |
| Helper deps | `clsx@2.1.1` already installed; `framer-motion` and `lucide-react` already installed |
| New deps needed | `tailwindcss@^4`, `@tailwindcss/postcss`, `class-variance-authority`, `tailwind-merge`, `prettier-plugin-tailwindcss` (dev) |
| CSP | Middleware sets per-request-nonce CSP; Tailwind emits a static stylesheet — no CSP interaction |
| Version contingency | If a v4 blocker surfaces during the foundation spike, fall back to Tailwind 3.4 + `tailwind.config.ts` with identical architecture. This is the only contingency; it does not delay the decision |

## 3. Installation and configuration (first implementation pass)

1. Add deps; create `postcss.config.mjs` with `@tailwindcss/postcss`.
2. Create `app/ui-v2.css` (imported in `app/layout.tsx` **after** `globals.css`):

```css
/* Hybrid period: tokens + utilities only. NO preflight — legacy pages stay pixel-identical. */
@layer theme, utilities;
@import "tailwindcss/theme" layer(theme);
@import "tailwindcss/utilities" layer(utilities);

@theme {
  /* Brand (mapped 1:1 from existing --ypp-* values in globals.css) */
  --color-brand-950: #1a0533;  /* --ypp-ink */
  --color-brand-900: #2a0847;
  --color-brand-800: #3b0f6e;  /* --ypp-deep / sidebar */
  --color-brand-700: #5a1da8;
  --color-brand-600: #6b21c8;  /* --ypp-primary */
  --color-brand-500: #8b3fe8;
  --color-brand-400: #b47fff;
  --color-brand-200: #e8d8ff;
  --color-brand-50:  #f3ecff;

  /* One semantic status set (consumed only via StatusBadge) */
  --color-success-600: #15803d;
  --color-warning-600: #b45309;
  --color-danger-600:  #dc2626;
  --color-info-600:    #1e40af;

  /* Surfaces */
  --color-surface: #ffffff;
  --color-surface-soft: #faf7ff;
  --color-line: rgb(107 33 200 / 0.15);
  --color-line-soft: rgb(107 33 200 / 0.08);

  /* Radius / shadow / type scale */
  --radius-card: 12px;
  --radius-control: 8px;
  --shadow-card: 0 1px 2px rgb(26 5 51 / 0.06), 0 4px 12px rgb(26 5 51 / 0.06);
  --shadow-overlay: 0 8px 30px rgb(26 5 51 / 0.18);
  --font-sans: "Inter", system-ui, sans-serif;
}
```

3. **Freeze `globals.css`**: record baseline line count; add a CI check to `check:release` that fails if the count increases.
4. During the hybrid period, legacy `--ypp-*` variables and `@theme` tokens alias the same hex values so the two systems cannot drift visually.
5. **Preflight** (`tailwindcss/preflight`) is enabled only in the final phase, after the legacy layer is deleted — until then, no global reset touches legacy pages, which makes adoption additive and rollback trivial.

## 4. Component architecture

```
components/
  ui-v2/                ← the design system. Tailwind-only. Never imports
    app-shell.tsx          legacy components; never uses globals.css classes.
    sidebar.tsx
    page-header.tsx
    section-header.tsx
    card.tsx
    stat-card.tsx
    data-table-shell.tsx
    filter-bar.tsx
    view-switcher.tsx       ← segmented "which view" control (distinct from filters)
    advanced-filters.tsx    ← the one "More filters" disclosure (native <details>)
    metric-strip.tsx        ← capped 3–5 click-to-filter StatCard strip
    tracker-shell.tsx       ← TrackerShell / TrackerRow / TrackerPreview family
    search-input.tsx
    status-badge.tsx
    entity-chip.tsx
    empty-state.tsx
    preview-panel.tsx
    action-button-group.tsx
    tabs.tsx
    drawer-shell.tsx
    command-palette.tsx    (HelpAgentShell builds on this)
    profile-header.tsx
    relationship-section.tsx
    timeline-section.tsx
    quick-action-bar.tsx
    form/  (input.tsx, select.tsx, textarea.tsx, field.tsx)
    button.tsx
    index.ts
```

Conventions:

- **Variants via `class-variance-authority`**, merging via `tailwind-merge` (`cn()` helper wrapping `clsx` + `twMerge`). No string-concatenated class soup in feature code — feature components pass variant props, not raw class lists, except for layout spacing.
- **Motion via `framer-motion`** with shared constants (durations 150/250ms, spring for drawers/palette, `prefers-reduced-motion` respected).
- **Icons via `lucide-react`**, sized by token (16/20px).
- Rebuilt domain components live in their domains but compose `ui-v2` exclusively.
- The V1 idea of building primitives in `components/shared/` on legacy CSS is **superseded** — primitives are built once, here, in Tailwind.

## 5. Primitive specifications (build order and contracts)

**Tranche 1 — Foundation (Phase 1):**

| Primitive | Contract |
|---|---|
| `AppShell` | Grid: fixed 280px sidebar + scrollable main; mobile collapse + backdrop (port existing behavior from `components/app-shell.tsx`); mounts `Entity360Provider` + `HelpAgentShell` |
| `Sidebar` | Dark premium chassis: brand-800 gradient, logo header, search, grouped nav, Recently Viewed, user footer. One component for all roles — content from existing nav resolution, chrome identical |
| `CommandPalette` | ⌘K overlay: input, grouped results, keyboard nav (↑↓, enter, esc, tab between groups), right preview slot, footer hints. Focus-trapped, ARIA combobox pattern |
| `PageHeader` | Title, subtitle, back/breadcrumb, primary + secondary actions, optional stat-strip slot |
| `Card` | Surface + radius-card + shadow-card; `padding="md(20px)|lg(24px)"`; header/footer slots |
| `StatCard` | Count, label, optional delta, **required `href`** (click-to-filter is the default behavior, not an option) |
| `StatusBadge` | Single source of status colors; variants: success/warning/danger/info/neutral; dot or pill |
| `EntityChip` | Entity icon + label; opens 360 preview on click, navigates on modifier-click (generalizes `RelatedEntityBadge`/`EntityLink` behavior) |
| `SearchInput` | Standard search affordance with ⌘K hint chip (now real) |
| `Tabs` | URL-synced, accessible (`role=tablist`), overflow behavior |
| `EmptyState` | One component, `tone="neutral|editorial"`, icon + title + body + action; replaces the three legacy patterns |
| `DrawerShell` | Right slide-over chassis: width tokens, header, scroll body, footer, stacking + back button, esc/route-change close (ports the proven `entity-360-drawer.tsx` mechanics into the new skin) |
| `PreviewPanel` | Docked variant of DrawerShell for wide layouts (master databases' right rail) |

**Tranche 2 — Records (Phase 2):** `DataTableShell` (header/filter/table/pagination/empty slots around existing `data-table.tsx` logic), `FilterBar` (chips + dropdowns + "More filters" disclosure + active-filter summary), `ProfileHeader` (avatar/initials, identity, status, quick actions), `ActionButtonGroup`, form primitives (`Field`, `Input`, `Select`, `Textarea` — label/help/error pattern, 8px radius, AA contrast).

**Tranche 2b — Intuitiveness reset (added with `docs/ypp-global-intuitiveness-design-system.md`):**

| Primitive | Contract |
|---|---|
| `ViewSwitcher` | Segmented control for "which slice of this page am I on?" — `views: {key,label,href,active,count?}[]`. Links, not client state. **Distinct from `FilterBar`** (which narrows the slice). Replaces hand-rolled `FilterChipLink` view loops (`/work`, `/partners`) and the local `Segmented` in `interview-filters.tsx`. |
| `AdvancedFilters` | The one "More filters" disclosure — native `<details>`, server-renderable, `defaultOpen` when a deep filter is active, optional `hint` showing the active filter. Replaces hand-rolled `<details>` blocks. |
| `MetricStrip` | Data-driven, **hard-capped** click-to-filter `StatCardV2` strip (`max=5`, Home's 6 is the only sanctioned exception). Enforces the density budget (§18 of the doctrine) so no page quietly grows a seventh headline tile. |
| `lib/ui/status-language.ts` | Not a component — the single status vocabulary (`STATUS_LANGUAGE`, `humanStatus()`, `BANNED_STATUS_WORDS`). One approved label + tone per concrete state; the source of truth behind §11 of the doctrine. Unit-tested in `tests/lib/status-language.test.ts`. |
| `TrackerShell` · `TrackerRow` · `TrackerPreview` | The tracker family (doctrine §5). `TrackerShell` is the canonical tracker page chassis (header → metrics → start-here → views → filters → list); `TrackerRow` is one scannable row (title · status · meta · next step · 1 action); `TrackerPreview` is the standard item-preview body for `PreviewPanel`/`DrawerShell`. Adopted on the rebuilt admin Application board; the foundation for the `/actions/all` + meeting-tracker rebuilds. Render-tested in `tests/components/tracker-shell.test.tsx`. |

Existing primitives that already satisfy the doctrine's named patterns (do **not** rebuild): `TrackerStartCard` = the "Start here / recommended next step" card; `EmptyStateV2` (+ action) = the empty-state-with-action; `ActionButtonGroup` / `PageHeaderV2 actions` = the primary-action bar; `RecordSection` / `SectionHeaderV2` = section summary.

**Tranche 3 — Depth (Phase 3):** `RelationshipSection` (chip clusters with section headers), `TimelineSection` (day-grouped event stream, ports `lib/operations/timeline.ts` rendering), `QuickActionBar`, `SectionHeader`.

## 6. Layout patterns (pages pick one; they don't invent one)

1. **Master database**: PageHeader → StatCard strip → FilterBar → DataTableShell → PreviewPanel rail. (`/people`, `/partners`, Work Hub tabs, Programs hub.)
2. **Record / 360 full page**: ProfileHeader → Tabs → sections (Cards, RelationshipSection, TimelineSection) → QuickActionBar. (Person/Partner/Class/Application full 360s.)
3. **Cockpit**: greeting → actionable StatCards → attention queue → today list → recent activity. (Leadership Home; instructor/student homes are calmer instances of the same pattern.)
4. **Focused task**: single column, sticky decision dock. (Application review per `FINAL_REVIEW_REDESIGN_PLAN.md`.)

Pages following the same product logic — clear purpose, easy search, obvious next action, depth via preview/360 — without being forced into one identical layout.

## 7. Visual rules

- **Dark premium sidebar:** brand-800 base, subtle gradient, white/brand-200 text, brand-400 active accent, 12px item radius, consistent 24px header padding. The sidebar is the brand anchor on every page for every role.
- **Light workspace:** surface/surface-soft canvas, 32px page gutters, 24px section gaps, line-soft borders, shadow-card for raised surfaces only, never decoration without information.
- **Type scale:** 28/600 page titles · 20/600 section titles · 16/500 card titles · 14/400 body · 12.5/500 labels/captions (uppercase sparingly).
- **Density:** tables 44–48px rows; previews comfortable (not compact); cockpits airy.
- **Responsive:** sidebar collapses below 1024px (existing behavior preserved); PreviewPanel becomes DrawerShell overlay below 1280px; tables hide priority-3 columns first.
- **Accessibility:** WCAG AA contrast on both sidebar and workspace; full keyboard support for palette/drawer/table row actions; visible `focus-visible` rings (brand-400, 2px); reduced-motion variants for all transitions. The `FINAL_REVIEW_REDESIGN_PLAN.md` accessibility bar applies portal-wide.

## 8. Guardrails against new mess

1. **CI line-count guard:** `globals.css` may never grow (script in `check:release`; baseline recorded at freeze).
2. **ESLint:**
   - No inline `style={{…}}` with hardcoded colors/spacing in redesigned route groups.
   - No legacy class names (`card`, `topbar`, `button`, `stat-card`, `badge`) in files importing from `ui-v2` (custom rule or restricted-syntax patterns).
   - `ui-v2/` may not import from legacy `components/` domains.
3. **Prettier `prettier-plugin-tailwindcss`** for canonical class order.
4. **Visual regression (Playwright, exists in repo):**
   - Hybrid-safety suite: screenshot baselines on ~15 high-traffic legacy pages (student home, instructor workspace, mentor hub, admin applicants board, etc.) run in CI to prove legacy pixels never move while Tailwind is added.
   - New-surface suite: a screenshot spec accompanies each shipped `ui-v2` surface.
5. **`docs/design-standards.md`:** one page per primitive with do/don't examples; PR checklist line: "uses ui-v2 primitives; no globals.css classes."

## 9. Migration phases and legacy containment

Progress is measured in **lines deleted from `globals.css`**, tracked in the release checklist.

| Phase | Surfaces moving to ui-v2 | Legacy CSS milestone |
|---|---|---|
| **1 Foundation** | AppShell + Sidebar (all roles inherit), Help Agent palette + `/help-agent` | Freeze (baseline recorded); no deletions yet — shell blocks become dead but stay until visual-regression confidence |
| **2 Front doors** | `/people`, `/partners`, admin instructor/student record pages, application review, leadership Home | **Deletion 1:** shell/sidebar/nav blocks + absorbed admin-list page styles |
| **3 Work & members** | Work Hub, Programs/Class 360, 360 chassis (DrawerShell/PreviewPanel everywhere), instructor-facing home/profile/classes, student-facing home/profile/classes/advisor | **Deletion 2:** card/table/badge/stat/tab/drawer blocks |
| **4 Cleanup** | Reports index, admin domain pages, remaining leadership surfaces | **Deletion 3:** per-domain page styles |
| **5 Sweep** | Decision on legacy/gamification pages (retire vs wholesale re-skin — **no early effort**, per the migration priority) | **Enable preflight.** Delete remaining layer down to a small, explicitly-named `legacy.css` covering only parked pages |

Hybrid rules during all phases:

- A page is either legacy or ui-v2 — never both (the shared AppShell is the single sanctioned junction).
- New features on legacy pages that can't wait for their rebuild may use Tailwind utilities inside their own component subtree, but never add to `globals.css`.
- Every absorbed/rebuilt page's legacy CSS is deleted or annotated `/* DEAD: replaced by ui-v2 <date> */` in the same PR.

## 10. Validation and rollback

**Validation per phase:** visual-regression green on legacy baselines · screenshot + axe checks on new surfaces · `validate-nav.mjs` + smoke (`check:release`) · `globals.css` delta ≤ 0 · bundle/CSS size reported (Tailwind v4 emits only used utilities; expect the new stylesheet to be a small fraction of the legacy file).

**Rollback levers, cheapest first:**

1. **Surface-level:** every rebuilt page lands behind the existing rollout discipline (`FeatureGateRule`/`RolloutCampaign` patterns); reverting = flipping the route back to the legacy page (kept for one release after each rebuild).
2. **System-level:** because preflight is off and legacy CSS is untouched in early phases, removing the `app/ui-v2.css` import disables the entire new layer without affecting any legacy page.
3. **Version-level:** Tailwind v4 → v3.4 fallback with the same architecture if a v4 blocker appears in the Phase-1 spike (the only sanctioned contingency).

**Definition of done for the migration:** preflight enabled; `globals.css` deleted or reduced to a parked `legacy.css`; every leadership, instructor, and student primary surface on ui-v2; lint guards active; the mockup-bar comparison in the master plan §30 passes.
