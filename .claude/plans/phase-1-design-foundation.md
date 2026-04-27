# Phase 1 — Design Foundation

## Goal

Establish the `.iv-*` (Interviewer View) design layer **additively**: new
CSS tokens, new utility classes, and new shared primitives. Nothing
existing breaks because nothing existing is touched.

Every later phase consumes this foundation. If we get this right, the
later phases become composition exercises rather than design exercises.

## Why first

- All later phases reference these classes. Building them up-front avoids
  per-phase color/spacing one-offs.
- Risk-free: purely additive, no existing rule overrides.
- Lets us preview the visual language in isolation before any user-facing
  surface changes.

## Files touched

| File | Change |
|---|---|
| `app/globals.css` | Append `/* === Interviewer View === */` section at the end (≈400–600 lines). No existing selectors edited. |
| `components/interviews/ui/StatusBadge.tsx` | New |
| `components/interviews/ui/Kbd.tsx` | New |
| `components/interviews/ui/EmptyState.tsx` | New |
| `components/interviews/ui/MetaList.tsx` | New |
| `components/interviews/ui/SectionHeader.tsx` | New |
| `components/interviews/ui/index.ts` | New barrel export |

No tests changed. No server code changed.

## Token spec

Append at end of `:root` in `globals.css` (or in a new self-contained block
to avoid merge conflicts):

```css
/* === Interviewer View tokens === */
:root {
  /* surfaces */
  --iv-surface: #ffffff;
  --iv-surface-raised: #ffffff;
  --iv-surface-tinted: #fbfaff;
  --iv-border: rgba(71, 85, 105, 0.16);
  --iv-border-strong: rgba(71, 85, 105, 0.28);
  --iv-line-faint: rgba(71, 85, 105, 0.08);

  /* semantic */
  --iv-success-surface: #f0fdf4;
  --iv-success-border: #bbf7d0;
  --iv-success-ink: #166534;
  --iv-success-accent: #16a34a;

  --iv-warning-surface: #fffbeb;
  --iv-warning-border: #fde68a;
  --iv-warning-ink: #92400e;
  --iv-warning-accent: #b45309;

  --iv-info-surface: #eff6ff;
  --iv-info-border: #bfdbfe;
  --iv-info-ink: #1e40af;
  --iv-info-accent: #1d4ed8;

  --iv-danger-surface: #fef2f2;
  --iv-danger-border: #fecaca;
  --iv-danger-ink: #991b1b;
  --iv-danger-accent: #dc2626;

  /* accent (purple) */
  --iv-accent: var(--ypp-purple-600);
  --iv-accent-soft: var(--ypp-purple-100);
  --iv-accent-ink: var(--ypp-purple-700);
  --iv-accent-tint: var(--ypp-purple-50);

  /* shadows */
  --iv-shadow-card: 0 1px 2px rgba(15, 23, 42, 0.04),
                    0 4px 16px rgba(59, 15, 110, 0.06);
  --iv-shadow-card-raised: 0 2px 4px rgba(15, 23, 42, 0.06),
                           0 12px 32px rgba(59, 15, 110, 0.10);
  --iv-shadow-dock: 0 -8px 24px rgba(59, 15, 110, 0.12);

  /* type scale (used inside .iv-* classes) */
  --iv-type-kicker-size: 11px;
  --iv-type-kicker-tracking: 0.08em;
}
```

## Class library

### Layout

```css
.iv-page { /* page wrapper, gutters, max-width */ }
.iv-section + .iv-section { margin-top: 24px; }
.iv-toolbar { /* row: title left, actions right */ }
```

### Cards / surfaces

```css
.iv-card { /* base premium card */ }
.iv-card-raised { /* shadow-card-raised */ }
.iv-card-accent { /* purple left border */ }
.iv-card-tone-success { /* success-surface */ }
.iv-card-tone-warning { /* warning-surface */ }
.iv-card-tone-info { /* info-surface */ }
.iv-card-tone-danger { /* danger-surface */ }
.iv-card-interactive { /* hover lift + cursor */ }
.iv-card-header { /* padding + border-bottom */ }
.iv-card-body { /* default padding */ }
.iv-card-footer { /* tinted footer */ }
```

### Status

```css
.iv-status-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}
.iv-status-badge::before {
  content: ""; width: 6px; height: 6px; border-radius: 999px; background: currentColor;
}
.iv-status-badge.is-needs-action { /* purple */ }
.iv-status-badge.is-scheduled    { /* info */ }
.iv-status-badge.is-completed    { /* success */ }
.iv-status-badge.is-blocked      { /* danger */ }
```

### KPI strip

```css
.iv-kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.iv-kpi-tile { /* surface, padding, label color, value size 24, delta */ }
.iv-kpi-tile-label { /* uppercase 11, tracking */ }
.iv-kpi-tile-value { /* 22 / 700 */ }
.iv-kpi-tile-delta { /* small, success/warning */ }
```

### Filters

```css
.iv-filter-chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
.iv-filter-chip {
  padding: 6px 12px; border-radius: 999px; font-size: 12px;
  border: 1px solid var(--iv-border); background: var(--iv-surface);
  transition: all 150ms;
}
.iv-filter-chip:hover { background: var(--iv-accent-tint); }
.iv-filter-chip.is-selected {
  background: var(--iv-accent-soft); color: var(--iv-accent-ink);
  border-color: var(--iv-accent); font-weight: 600;
}
.iv-filter-chip:focus-visible { outline: 2px solid var(--ypp-purple-400); outline-offset: 2px; }

.iv-segmented { /* mac-style group, single border, dividers between */ }
```

### Empty / loading

```css
.iv-empty-state { /* centered, max-w 520, dashed border, icon, helper */ }
.iv-skeleton { /* shimmer like .cockpit-skel */ }
```

### Form bits

```css
.iv-meta-list { display: grid; grid-template-columns: max-content 1fr; row-gap: 6px; column-gap: 12px; }
.iv-meta-list dt { color: var(--muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.iv-meta-list dd { font-size: 14px; }
```

### Section header

```css
.iv-section-header { /* kicker + title + helper, optional right slot */ }
.iv-section-header-kicker { /* tracking 0.08em, var(--iv-accent-ink) */ }
.iv-section-header h2 { font-size: 18px; }
```

### Sticky toolbar / dock

```css
.iv-sticky-dock {
  position: sticky; bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,0.96); backdrop-filter: blur(8px);
  border-top: 1px solid var(--iv-border);
  box-shadow: var(--iv-shadow-dock);
  padding: 12px 24px;
  z-index: 40;
}
.iv-submit-dock { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; }
.iv-submit-dock-summary { /* validation summary inline */ }
```

### Live workspace bits (Phase 4 will use)

```css
.iv-save-chip { /* premium autosave with state colors */ }
.iv-save-chip.is-saved { /* success */ }
.iv-save-chip.is-saving { /* info, animated dot */ }
.iv-save-chip.is-dirty { /* warning */ }
.iv-save-chip.is-error { /* danger */ }

.iv-timer-chip { /* monospace HH:MM:SS, surface tinted */ }

.iv-focus-mode-button { /* toggle, with kbd hint */ }

.iv-question-nav { display: flex; flex-direction: column; gap: 4px; }
.iv-question-nav-item {
  display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  border: 1px solid transparent; background: transparent;
  text-align: left;
}
.iv-question-nav-item:hover { background: var(--iv-accent-tint); }
.iv-question-nav-item.is-active { background: var(--iv-accent-soft); border-color: var(--iv-accent); }
.iv-question-nav-item.is-asked { /* green dot */ }
.iv-question-nav-item.is-skipped { /* gray dot, strikethrough number */ }
.iv-question-nav-item.is-untouched { /* muted */ }

.iv-tag-chip {
  padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--iv-border); background: var(--iv-surface);
}
.iv-tag-chip.is-selected { font-weight: 600; }
.iv-tag-chip.tone-success.is-selected { /* success colors */ }
.iv-tag-chip.tone-warning.is-selected { /* warning colors */ }
.iv-tag-chip.tone-danger.is-selected  { /* danger colors */ }
.iv-tag-chip.tone-info.is-selected    { /* info colors */ }

.iv-rating-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.iv-rating-option {
  border: 2px solid transparent; border-radius: 12px;
  padding: 10px 12px; background: var(--iv-surface);
  text-align: left; transition: all 150ms;
}
.iv-rating-option:hover { border-color: var(--iv-border-strong); }
.iv-rating-option.is-selected { border-color: var(--rating-color); background: var(--rating-bg); }
```

### Kbd

```css
.iv-kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  border: 1px solid var(--iv-border-strong); border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--iv-surface);
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--gray-700);
}
```

## Primitive specs

### `StatusBadge.tsx`

```tsx
type Tone = "needs-action" | "scheduled" | "completed" | "blocked" | "info" | "neutral";
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`iv-status-badge is-${tone}`}>{children}</span>;
}
```

### `Kbd.tsx`

```tsx
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="iv-kbd">{children}</kbd>;
}
```

### `EmptyState.tsx`

```tsx
type Props = { title: string; helper?: string; action?: ReactNode; icon?: ReactNode };
export function EmptyState({ title, helper, action, icon }: Props) { … }
```

### `MetaList.tsx`

```tsx
type Item = { label: string; value: ReactNode };
export function MetaList({ items }: { items: Item[] }) { … }
```

### `SectionHeader.tsx`

```tsx
type Props = { kicker?: string; title: string; helper?: string; right?: ReactNode };
export function SectionHeader({ kicker, title, helper, right }: Props) { … }
```

### `index.ts`

```ts
export { StatusBadge } from "./StatusBadge";
export { Kbd } from "./Kbd";
export { EmptyState } from "./EmptyState";
export { MetaList } from "./MetaList";
export { SectionHeader } from "./SectionHeader";
```

## Risks

- Token name collision with `--cockpit-*` or `--ypp-*` — mitigated by the
  `--iv-` prefix.
- CSS file growth — globals.css is already 9,967 lines. Acceptable trade-
  off for namespace consistency; if it crosses 12k, consider extracting to
  `app/styles/iv.css` and importing from `globals.css` (defer that until
  Phase 8 if needed).
- Unused primitives — fine for Phase 1; they get consumed in Phases 2–6.

## Acceptance criteria

- `npm run typecheck` passes.
- `npm run build` passes.
- Visiting any existing route shows zero visual regression.
- New primitives importable from `@/components/interviews/ui`.
- New `.iv-*` classes resolve to expected styles when sprinkled into a test
  page (manual sanity).

## Commit

```
feat(interviews): establish premium interviewer UI foundation

Add the .iv-* design layer (tokens, classes, primitives) under
components/interviews/ui/ and the new section in app/globals.css. Purely
additive — no existing selectors or components touched.

Foundation for the dashboard, cockpit, and live-workspace upgrades in
follow-up phases.
```
