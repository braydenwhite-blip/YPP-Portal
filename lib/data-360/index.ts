/**
 * Data 360 read layer — barrel.
 *
 * YPP's organizational-intelligence surface. Pure, deterministic, read-only
 * aggregation over existing portal data with zero synthetic scores. See
 * `docs/DATA_360_ROADMAP.md`.
 */
export * from "./types";
export { parseRangeKey, resolveRange, rangeWhere } from "./range";
export { buildMonthlyCumulative, seriesWindowStart } from "./timeseries";
export {
  METRIC_REGISTRY,
  getMetric,
  type MetricDefinition,
  type MetricCadence,
  type MetricVisibility,
} from "./registry";
export {
  DATA_360_LENSES,
  LENS_LABELS,
  LENS_BLURBS,
  LENS_GROUP_ORDER,
  defaultLensForRole,
  type Data360Lens,
} from "./views";
export { buildKpis, formatCount, type OverviewCounts } from "./metrics";
export { loadData360Overview } from "./overview";
export { loadNeedsAttention, groupAttention, ATTENTION_HINTS } from "./needs-attention";
