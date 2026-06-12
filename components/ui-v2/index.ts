/**
 * Design System 2.0 — Knowledge OS V2 primitives (Tailwind-first).
 *
 * Rules (docs/ypp-tailwind-design-system-v2-plan.md):
 * - This folder never imports legacy domain components and never relies on
 *   app/globals.css class names.
 * - Feature components compose these primitives; one-off styling on
 *   redesigned surfaces is a review flag.
 */
export { cn } from "./cn";
export { Button, ButtonLink, buttonVariants } from "./button";
export { CardV2 } from "./card";
export { PageHeaderV2 } from "./page-header";
export { SectionHeaderV2 } from "./section-header";
export { StatusBadge, ENTITY_TONE_TO_BADGE, type StatusTone } from "./status-badge";
export { EntityChip } from "./entity-chip";
export { StatCardV2 } from "./stat-card";
export { EmptyStateV2 } from "./empty-state";
export { SearchInputV2 } from "./search-input";
export { ActionButtonGroup } from "./action-button-group";
export { PreviewPanel } from "./preview-panel";
export {
  DataTableShell,
  TableV2,
  TableHeadCell,
  TableCell,
} from "./data-table-shell";
export { CommandPaletteShell } from "./command-palette";
export { ProfileHeader } from "./profile-header";
export { KeyFactsGrid, type KeyFact } from "./key-facts";
export { RecordSection } from "./record-section";
export { Checklist, type ChecklistItem } from "./checklist";
export { DecisionDock, type DecisionOption } from "./decision-dock";
export { FilterBar, FilterChipLink, UrlSyncedSearchInput } from "./filter-bar";
export { LegacySurfaceBanner } from "./legacy-surface-banner";
export {
  SidebarChevron,
  SidebarUserCard,
  sidebarBadgeClass,
  sidebarFilterInputClass,
  sidebarFooterClass,
  sidebarGhostButtonClass,
  sidebarGroupToggleVariants,
  sidebarHeaderClass,
  sidebarIconVariants,
  sidebarLinkVariants,
  sidebarNewBadgeClass,
  sidebarSectionTitleClass,
  sidebarSurfaceClass,
} from "./sidebar";
