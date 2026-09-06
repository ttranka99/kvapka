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
import { addWarning } from "../ui/warnings.js";

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

export let slicerOrientation = activeTheme.defaultSlicerOrientation;
// Which side of the canvas the vertical slicer column stands on. Meaningless
// while slicers are horizontal, but kept as its own binding (not derived
// from the theme at read time) for the same reason slicerOrientation is: a
// page can carry it across a theme switch via options.keepOrientation.
export let SLICER_SIDE = activeTheme.slicerSide;

export let slicers = [];
// KPI cards, keyed by the id of the `kpi` section (in theme.sections) they
// belong to. However many KPI bands a theme defines, each gets exactly one
// entry here — a page switching between themes with different band counts
// is reconciled by applyTheme() (see reconcileKpiBands below), never by
// this module reaching into theme internals itself.
export let kpiBands = {};
export let chartRows = [];
export let selectedElement = null;
export let warnings = [];

export function setSlicers(v) { slicers = v; }
export function getKpiBand(id) { return kpiBands[id] || []; }
export function setKpiBands(v) { kpiBands = v; }
export function setKpiBand(id, list) { kpiBands = { ...kpiBands, [id]: list }; }
/** Ids of the theme's `kpi` sections, in `sections` order. */
export function kpiBandIds() {
  return activeTheme.sections.filter(s => s.type === "kpi").map(s => s.id);
}
export function setChartRows(v) { chartRows = v; }
export function setSelectedElement(v) { selectedElement = v; }
export function setWarnings(v) { warnings = v; }
export function setEffectiveScale(v) { EFFECTIVE_SCALE = v; }

export function setSlicerOrientation(v) {
  slicerOrientation = v === "vertical" ? "vertical" : "horizontal";
}

export function isVerticalSlicers() { return slicerOrientation === "vertical"; }

export function setSlicerSide(v) {
  SLICER_SIDE = v === "right" ? "right" : "left";
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
  const oldSections = activeTheme.sections;
  const oldKpiBands = kpiBands;

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
    setSlicerSide(t.slicerSide);
  }

  kpiBands = reconcileKpiBands(oldSections, t.sections, oldKpiBands, options.keepEmptyBands);

  return activeTheme;
}

/**
 * Carries a page's KPI cards across a theme switch, however many `kpi`
 * sections each theme has. Four rules, tried in order for every band in the
 * *new* theme:
 *
 *   1. id match — the same section id existed before: keep its cards
 *      verbatim (the common case — most theme switches don't touch section
 *      ids at all).
 *   2. positional fallback — the Nth still-unmatched new band inherits the
 *      Nth still-unmatched old band's cards. This is what keeps the header
 *      KPIs alive when switching between two unrelated themes whose ids
 *      differ; matching by id alone would silently wipe them.
 *   3. seed — a band that still has nothing gets `defaultCount` blanks, but
 *      only when that default is greater than zero. The header band's
 *      default is 0 (initState.js starts it empty), so this only ever
 *      fires for a band meant to show something immediately.
 *
 * A fourth pass then rehomes any *old* band nothing above claimed: its cards
 * move to the nearest surviving new band (nearest by position in the theme's
 * section list) rather than vanishing, and only get dropped — with a
 * warning — if the new theme has no KPI section left at all.
 */
function reconcileKpiBands(oldSections, newSections, oldBands, keepEmptyBands) {
  const oldKpiSections = oldSections.filter(s => s.type === "kpi");
  const newKpiSections = newSections.filter(s => s.type === "kpi");

  const next = {};
  const claimedOldIds = new Set();

  // 1. id match.
  newKpiSections.forEach(s => {
    if (oldKpiSections.some(o => o.id === s.id) && oldBands[s.id] !== undefined) {
      next[s.id] = oldBands[s.id];
      claimedOldIds.add(s.id);
    }
  });

  // 2. positional fallback.
  const unmatchedOld = oldKpiSections.filter(o => !claimedOldIds.has(o.id));
  const unmatchedNew = newKpiSections.filter(s => next[s.id] === undefined);
  unmatchedNew.forEach((s, i) => {
    const donor = unmatchedOld[i];
    if (donor && oldBands[donor.id] !== undefined) {
      next[s.id] = oldBands[donor.id];
      claimedOldIds.add(donor.id);
    }
  });

  // 3. seed.
  newKpiSections.forEach(s => {
    if (next[s.id] !== undefined) return;
    next[s.id] = s.defaultCount > 0 && !keepEmptyBands
      ? Array.from({ length: s.defaultCount }, () => ({ height: null, locked: false }))
      : [];
  });

  // 4. rehome orphans.
  oldKpiSections
    .filter(o => !claimedOldIds.has(o.id))
    .forEach(o => {
      const cards = oldBands[o.id];
      if (!cards || cards.length === 0) return;

      if (newKpiSections.length === 0) {
        addWarning(
          `Šablona bez pásu KPI — ${cards.length} KPI karet z odstraněného pásu bylo zahozeno.`,
          "warning"
        );
        return;
      }

      const oldIndex = oldSections.indexOf(o);
      let nearest = newKpiSections[0];
      let nearestDist = Infinity;
      newKpiSections.forEach(s => {
        const dist = Math.abs(newSections.indexOf(s) - oldIndex);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = s;
        }
      });
      next[nearest.id] = [...(next[nearest.id] || []), ...cards];
    });

  return next;
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
  const next = {};
  for (const id of Object.keys(kpiBands)) {
    next[id] = kpiBands[id].map(k => ({ ...k, width: null, height: null, locked: false }));
  }
  kpiBands = next;
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
export function getChartRows() { return chartRows; }
