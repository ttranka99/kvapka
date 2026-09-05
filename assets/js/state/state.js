// assets/js/state/state.js
//
// Live layout state, plus the constants every solver reads.
//
// Those constants used to be hardcoded here, with a two-entry LAYOUT_TEMPLATES
// table switching a handful of them between HD and FULL HD. They are now
// projected from a *theme* (assets/js/theme/themeModel.js) — a JSON object
// holding every one of them, which the user can edit, save and share. The
// exported bindings below stay exactly what they were, so the solvers did not
// have to change: ES module bindings are live views, and every consumer reads
// them at call time (`state.GAP_SMALL`, or a named import used inside a
// function), never snapshotting them at module load. Anything the theme can
// change is therefore a `let` assigned by applyTheme() — including several
// values that used to be `const` because nothing could vary them yet.

import { normalizeTheme, cloneTheme, BUILTIN_THEMES } from "../theme/themeModel.js";
import { getTheme } from "../theme/themeStore.js";
import { setStep } from "../layout/sizeStep.js";

export let activeTheme = normalizeTheme(BUILTIN_THEMES[0]);
export let activeTemplate = activeTheme.id;

export let CANVAS_WIDTH = activeTheme.canvasWidth;
export let CANVAS_HEIGHT = activeTheme.canvasHeight;
export let MARGIN = activeTheme.margin;
export let TITLE_HEIGHT = activeTheme.titleHeight;
export let GAP_SMALL = activeTheme.gapSmall;
export let GAP_KPI_TO_CHARTS = activeTheme.gapKpiToCharts;
export let SLICER_HEIGHT = activeTheme.slicerHeight;
// Vertical-slicer mode: slicers stack in a single fixed-width column on the
// left instead of a horizontal band under the title. SLICER_HEIGHT keeps its
// meaning as the per-slicer *minimum* (and default) height in that mode.
export let SLICER_COLUMN_WIDTH = activeTheme.slicerColumnWidth;
export let MIN_SLICER_COLUMN_WIDTH = activeTheme.minSlicerColumnWidth;
export let MAX_SLICER_COLUMN_WIDTH = activeTheme.maxSlicerColumnWidth;
// Once the natural (minimum-height) stack would already fill this much of the
// column, the unlocked slicers are expanded to fill it exactly instead — a
// nearly-full column with a ragged empty tail reads as a bug, not a choice.
export let SLICER_FILL_THRESHOLD = activeTheme.slicerFillThreshold;
export let KPI_MIN_HEIGHT = activeTheme.kpiMinHeight;
export let MIN_SLICER_WIDTH = activeTheme.minSlicerWidth;
export let MIN_CHART_ROW_HEIGHT = activeTheme.minChartRowHeight;
export let MIN_CHART_WIDTH = activeTheme.minChartWidth;
// Absolute floor a chart row/stacked-cell height can be squeezed to when the
// layout's usual minimums (MIN_CHART_ROW_HEIGHT and stack minimums) don't
// all fit within the canvas's available charts area — e.g. many rows on the
// smaller HD template. Rows still render (never overflow the canvas) but a
// warning is raised so the user knows content was shrunk below its normal
// minimum.
export let HARD_MIN_CHART_HEIGHT = activeTheme.hardMinChartHeight;
export let USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;
export const SCALE = 0.4;
// The scale actually used for rendering, after shrinking SCALE down (if needed)
// to fit the canvas within the available viewport width. Kept in sync with
// SCALE unless the viewport is too narrow. Read by renderLayout.js (drawing)
// and chartResizeEvents.js (converting pointer drag deltas back to px).
export let EFFECTIVE_SCALE = SCALE;
export let MIN_COMPONENTS_PER_ROW = activeTheme.minPerRow;
export let MAX_COMPONENTS_PER_ROW = activeTheme.maxPerRow;
export let SECOND_ROW_MAX_ITEMS = activeTheme.secondRowMaxItems;
export let MAX_SLICERS = activeTheme.defaultSlicersPerRow;
export let MAX_KPIS = activeTheme.defaultKpisPerRow;

// The optional second KPI band, placed inside the chart area rather than
// under the header — { enabled, afterRow, defaultCount }. See
// layout/computeVerticalLayout.js for how it reserves its slice of height.
export let KPI_BAND_2 = { ...activeTheme.kpiBand2 };

export let slicerOrientation = activeTheme.defaultSlicerOrientation;

export let slicers = [];
export let kpis = [];
// The middle band's KPIs, kept as their own list rather than a flag on
// entries of `kpis`: the two bands sit in different places on the canvas,
// have independent counts and independent per-row limits, and every solver
// that walks a band wants exactly one of them at a time.
export let kpis2 = [];
export let chartRows = [];
export let selectedElement = null;
export let warnings = [];

export function setSlicers(v) { slicers = v; }
export function setKpis(v) { kpis = v; }
export function setKpis2(v) { kpis2 = v; }
export function setChartRows(v) { chartRows = v; }
export function setSelectedElement(v) { selectedElement = v; }
export function setWarnings(v) { warnings = v; }
export function setEffectiveScale(v) { EFFECTIVE_SCALE = v; }

export function setSlicerOrientation(v) {
  slicerOrientation = v === "vertical" ? "vertical" : "horizontal";
}

export function isVerticalSlicers() { return slicerOrientation === "vertical"; }

/** Whether the theme in force places a second KPI band among the charts. */
export function hasKpiBand2() { return KPI_BAND_2.enabled === true; }

/**
 * Which chart row the middle KPI band sits below, clamped to the rows that
 * actually exist. A theme may name a row a given page hasn't got (it was
 * authored against a fuller layout), and the band still has to land
 * somewhere sensible — directly under the last row in that case.
 */
export function kpiBand2AfterRow() {
  if (!hasKpiBand2()) return -1;
  return Math.min(KPI_BAND_2.afterRow, Math.max(0, chartRows.length - 1));
}

export function setSlicerColumnWidth(v) {
  SLICER_COLUMN_WIDTH = Math.min(
    MAX_SLICER_COLUMN_WIDTH,
    Math.max(MIN_SLICER_COLUMN_WIDTH, v)
  );
}

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

/**
 * Projects a theme onto every constant the solvers read. This is the only
 * place those bindings are assigned wholesale, so "what does this theme
 * actually change?" has exactly one answer to read.
 *
 * Per-row limits and the slicer orientation are reset to the theme's own
 * defaults, matching how a template switch always did — a limit of 7 carried
 * onto a theme that caps rows at 5 would be silently out of range.
 */
export function applyTheme(theme, options = {}) {
  const t = normalizeTheme(theme);

  activeTheme = t;
  activeTemplate = t.id;

  CANVAS_WIDTH = t.canvasWidth;
  CANVAS_HEIGHT = t.canvasHeight;
  MARGIN = t.margin;
  TITLE_HEIGHT = t.titleHeight;
  GAP_SMALL = t.gapSmall;
  GAP_KPI_TO_CHARTS = t.gapKpiToCharts;
  SLICER_HEIGHT = t.slicerHeight;
  MIN_SLICER_WIDTH = t.minSlicerWidth;
  MIN_SLICER_COLUMN_WIDTH = t.minSlicerColumnWidth;
  MAX_SLICER_COLUMN_WIDTH = t.maxSlicerColumnWidth;
  // Back to the theme's own default rather than carrying over a width the
  // user dragged under the previous one — 290px is over a fifth of the HD
  // canvas, and the min/max bounds move with the theme too.
  SLICER_COLUMN_WIDTH = t.slicerColumnWidth;
  SLICER_FILL_THRESHOLD = t.slicerFillThreshold;
  KPI_MIN_HEIGHT = t.kpiMinHeight;
  MIN_CHART_ROW_HEIGHT = t.minChartRowHeight;
  MIN_CHART_WIDTH = t.minChartWidth;
  HARD_MIN_CHART_HEIGHT = t.hardMinChartHeight;
  USABLE_WIDTH = CANVAS_WIDTH - 2 * MARGIN;

  MIN_COMPONENTS_PER_ROW = t.minPerRow;
  MAX_COMPONENTS_PER_ROW = t.maxPerRow;
  SECOND_ROW_MAX_ITEMS = t.secondRowMaxItems;
  KPI_BAND_2 = { ...t.kpiBand2 };

  setStep(t.step);

  if (!options.keepRowLimits) {
    MAX_SLICERS = clampComponentsPerRow(t.defaultSlicersPerRow);
    MAX_KPIS = clampComponentsPerRow(t.defaultKpisPerRow);
  } else {
    MAX_SLICERS = clampComponentsPerRow(MAX_SLICERS);
    MAX_KPIS = clampComponentsPerRow(MAX_KPIS);
  }

  if (!options.keepOrientation) {
    setSlicerOrientation(t.defaultSlicerOrientation);
  }

  // A theme without the middle band must not leave orphaned KPIs stranded
  // off-canvas — they belong to a band that no longer exists. A theme *with*
  // one seeds it, so turning the band on shows cards immediately instead of
  // an empty reserved strip the user has to guess at.
  if (!KPI_BAND_2.enabled) {
    kpis2 = [];
  } else if (kpis2.length === 0 && !options.keepEmptyBand2) {
    kpis2 = Array.from({ length: KPI_BAND_2.defaultCount }, () => ({ height: null, locked: false }));
  }

  return activeTheme;
}

/**
 * Applies a theme by id, resolving built-ins and saved custom themes alike.
 * Unknown ids are ignored so a page whose custom theme was deleted keeps
 * whatever it is currently rendering instead of collapsing to a default.
 */
export function setLayoutTemplate(templateKey) {
  const theme = getTheme(templateKey);
  if (!theme) return null;
  return applyTheme(theme);
}

export function getActiveTheme() { return cloneTheme(activeTheme); }

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
  slicers = slicers.map(s => ({ ...s, width: null, height: null, locked: false }));
}

export function resetKpiSizingLocks() {
  kpis = kpis.map(k => ({ ...k, width: null, height: null, locked: false }));
  kpis2 = kpis2.map(k => ({ ...k, width: null, height: null, locked: false }));
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
// (i.e. a theme switch), since that can invalidate every kind of locked size
// at once.
export function resetSizingLocks() {
  resetSlicerSizingLocks();
  resetKpiSizingLocks();
  resetChartWidthLocks();
  resetChartRowHeightLocks();
}

// gettery pro computeVerticalLayout
export function getSlicers() { return slicers; }
export function getKpis() { return kpis; }
export function getKpis2() { return kpis2; }
export function getChartRows() { return chartRows; }
