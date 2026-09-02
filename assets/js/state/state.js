// assets/js/state/state.js
export const LAYOUT_TEMPLATES = {
  FULL_HD: {
    label: "FULL HD",
    canvasWidth: 1920,
    canvasHeight: 1080,
    margin: 30,
    titleHeight: 50,
    gapKpiToCharts: 30,
    slicerHeight: 80,
    kpiMinHeight: 90,
    minSlicerWidth: 50,
    minChartRowHeight: 150
  },
  HD: {
    label: "HD",
    canvasWidth: 1280,
    canvasHeight: 720,
    margin: 20,
    titleHeight: 40,
    gapKpiToCharts: 20,
    slicerHeight: 70,
    kpiMinHeight: 80,
    minSlicerWidth: 50,
    minChartRowHeight: 100
  }
};

export let activeTemplate = "FULL_HD";
export let CANVAS_WIDTH = LAYOUT_TEMPLATES.FULL_HD.canvasWidth;
export let CANVAS_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.canvasHeight;
export let MARGIN = LAYOUT_TEMPLATES.FULL_HD.margin;
export let TITLE_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.titleHeight;
export const GAP_SMALL = 10;
export let GAP_KPI_TO_CHARTS = LAYOUT_TEMPLATES.FULL_HD.gapKpiToCharts;
export let SLICER_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.slicerHeight;
export let KPI_MIN_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.kpiMinHeight;
export let MIN_SLICER_WIDTH = LAYOUT_TEMPLATES.FULL_HD.minSlicerWidth;
export let MIN_CHART_ROW_HEIGHT = LAYOUT_TEMPLATES.FULL_HD.minChartRowHeight;
export const MIN_CHART_WIDTH = 150;
// Absolute floor a chart row/stacked-cell height can be squeezed to when the
// layout's usual minimums (MIN_CHART_ROW_HEIGHT and stack minimums) don't
// all fit within the canvas's available charts area — e.g. many rows on the
// smaller HD template. Rows still render (never overflow the canvas) but a
// warning is raised so the user knows content was shrunk below its normal
// minimum.
export const HARD_MIN_CHART_HEIGHT = 40;
export let USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
export const SCALE = 0.4;
// The scale actually used for rendering, after shrinking SCALE down (if needed)
// to fit the canvas within the available viewport width. Kept in sync with
// SCALE unless the viewport is too narrow. Read by renderLayout.js (drawing)
// and chartResizeEvents.js (converting pointer drag deltas back to px).
export let EFFECTIVE_SCALE = SCALE;
export const MIN_COMPONENTS_PER_ROW = 4;
export const MAX_COMPONENTS_PER_ROW = 7;
export const SECOND_ROW_MAX_ITEMS = 7;
export let MAX_SLICERS = 7;
export let MAX_KPIS = 6;

export let slicers = [];
export let kpis = [];
export let chartRows = [];
export let selectedElement = null;
export let warnings = [];

export function setSlicers(v) { slicers = v; }
export function setKpis(v) { kpis = v; }
export function setChartRows(v) { chartRows = v; }
export function setSelectedElement(v) { selectedElement = v; }
export function setWarnings(v) { warnings = v; }
export function setEffectiveScale(v) { EFFECTIVE_SCALE = v; }

function clampComponentsPerRow(v) {
  const value = Number.parseInt(v, 10);
  if (Number.isNaN(value)) return MAX_COMPONENTS_PER_ROW;
  return Math.min(MAX_COMPONENTS_PER_ROW, Math.max(MIN_COMPONENTS_PER_ROW, value));
}

export function setMaxSlicers(v) {
  MAX_SLICERS = clampComponentsPerRow(v);
}

export function setMaxKpis(v) {
  MAX_KPIS = clampComponentsPerRow(v);
}

export function setLayoutTemplate(templateKey) {
  const template = LAYOUT_TEMPLATES[templateKey];
  if (!template) return;

  activeTemplate = templateKey;
  CANVAS_WIDTH = template.canvasWidth;
  CANVAS_HEIGHT = template.canvasHeight;
  MARGIN = template.margin;
  TITLE_HEIGHT = template.titleHeight;
  GAP_KPI_TO_CHARTS = template.gapKpiToCharts;
  SLICER_HEIGHT = template.slicerHeight;
  KPI_MIN_HEIGHT = template.kpiMinHeight;
  MIN_SLICER_WIDTH = template.minSlicerWidth;
  MIN_CHART_ROW_HEIGHT = template.minChartRowHeight;
  USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
}

// --- Granular sizing-lock resets ---
//
// Historically there was a single resetSizingLocks() that wiped every
// locked size (slicers, KPIs, chart widths, chart row heights) at once.
// That's correct for a template switch, since it changes both CANVAS_WIDTH
// (affecting horizontal locks: slicer/KPI/chart widths) and CANVAS_HEIGHT
// (affecting chart row height locks) at the same time.
//
// But changing just "slicers per row" or "KPIs per row" only ever affects
// MAX_SLICERS/MAX_KPIS — USABLE_WIDTH is untouched, so chart *widths* can
// never overflow because of it. It can shift the vertical layout though
// (more/fewer slicer or KPI rows changes chartsTop/chartsHeight), so chart
// *row heights* can still legitimately need resetting. Calling the old
// blanket resetSizingLocks() for a mere per-row-limit change was therefore
// wiping chart width locks (and the charts' visual sizes) for no reason —
// this split lets each caller reset only what its change could actually
// invalidate.

export function resetSlicerSizingLocks() {
  slicers = slicers.map(s => ({ ...s, width: null, locked: false }));
}

export function resetKpiSizingLocks() {
  kpis = kpis.map(k => ({ ...k, width: null, height: null, locked: false }));
}

export function resetChartWidthLocks() {
  chartRows = chartRows.map(row => ({
    ...row,
    items: row.items.map(item => ({
      width: null,
      locked: false,
      // Stacked cells survive a width/lock reset (only their own sizing is
      // reset here) — width resets are triggered by things that can't
      // themselves invalidate a vertical stack (per-row slicer/KPI count
      // changes, template switches alongside the height reset below).
      ...(item.stack ? { stack: item.stack.map(() => ({ height: null, locked: false })) } : {})
    }))
  }));
}

export function resetChartRowHeightLocks() {
  chartRows = chartRows.map(row => ({
    ...row,
    height: null,
    locked: false
  }));
}

// Full reset — use when CANVAS_WIDTH and/or CANVAS_HEIGHT themselves changed
// (i.e. a template switch), since that can invalidate every kind of locked
// size at once.
export function resetSizingLocks() {
  resetSlicerSizingLocks();
  resetKpiSizingLocks();
  resetChartWidthLocks();
  resetChartRowHeightLocks();
}

// gettery pro computeVerticalLayout
export function getSlicers() { return slicers; }
export function getKpis() { return kpis; }
export function getChartRows() { return chartRows; }